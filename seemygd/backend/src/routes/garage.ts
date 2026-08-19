import { Hono } from "hono";
import sharp from "sharp";
import { DEBUG_SECRET_HEADER, resolveTraceMode } from "../debug-access";
import { detectDoor, openaiVision } from "../door-detect";
import { MANUFACTURERS, STYLES, SwapRequestFieldsSchema } from "../types";

const garageRouter = new Hono();

/**
 * How far outside the detected box the model may paint, as a fraction of the
 * box's own size.
 *
 * This is deliberately loose, and the reason is worth keeping.
 *
 * The version of this tool everyone liked also sent a mask — but its detector
 * copied the example box out of its own prompt on nearly every photo, so the
 * mask was almost always the same generic rectangle covering ~63% of the
 * image. It never actually constrained anything. The model was free to put the
 * door where the door goes, and it did.
 *
 * Detection later became genuinely accurate, which quietly turned the same 5%
 * padding into a real constraint for the first time. A masked model cannot
 * paint outside its mask, so any error in a tight box stopped being a cosmetic
 * crop and became a door squashed into the wrong rectangle. Tightening the
 * leash is what broke placement.
 *
 * So: keep a mask, because a border of untouched photo stops the model
 * reinventing the whole frame and keeps the diff below honest — but keep it
 * loose enough that it is a hint about where to work, never a box the door has
 * to fit inside.
 */
const MASK_PAD = 0.4;

// Creates a mask PNG: opaque white everywhere except the door area (transparent).
// Transparent pixels = AI may edit; opaque pixels = AI must preserve.
async function createDoorMask(
  width: number,
  height: number,
  bbox: { x: number; y: number; w: number; h: number }
): Promise<Buffer> {
  const padW = Math.round(bbox.w * width * MASK_PAD);
  const padH = Math.round(bbox.h * height * MASK_PAD);
  const doorX = Math.max(0, Math.round(bbox.x * width) - padW);
  const doorY = Math.max(0, Math.round(bbox.y * height) - padH);
  const doorW = Math.min(width - doorX, Math.round(bbox.w * width) + padW * 2);
  const doorH = Math.min(height - doorY, Math.round(bbox.h * height) + padH * 2);

  // Opaque white base = everything is preserved by default
  const base = await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .png()
    .toBuffer();

  // Transparent rectangle = the door area the AI is allowed to edit
  const doorCutout = await sharp({
    create: { width: doorW, height: doorH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();

  return sharp(base)
    .composite([{ input: doorCutout, left: doorX, top: doorY }])
    .png()
    .toBuffer();
}

// Returns a precise panel layout description for the given style and detected door size.
// This is injected into the AI generation prompt to ensure correct panel counts.
function buildLayoutDesc(
  styleId: string,
  category: string,
  widthClass: "single" | "double",
  heightClass: "standard" | "tall"
): string {
  const single = widthClass === "single";
  const tall = heightClass === "tall";
  const wFt = single ? 9 : 16;
  const hFt = tall ? 8 : 7;

  // Full-view glass (Clopay Avante, Amarr Vista, Wayne Dalton 8800)
  if (["clopay-avante", "amarr-vista", "wayne-dalton-8800"].includes(styleId)) {
    const cols = single ? 4 : 8;
    const rows = tall ? 4 : 3;
    return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. Render exactly ${cols} glass panels across × ${rows} glass sections tall (${cols}×${rows} grid of glass panes within the aluminum frame).`;
  }

  // Flush modern — no raised panels, just horizontal seam lines
  if (["clopay-modern-steel", "haas-700", "amarr-hillcrest"].includes(styleId)) {
    const sections = tall ? 5 : 4;
    return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. ${sections} flush horizontal sections of equal height, each spanning the full door width with barely visible seam lines — absolutely no vertical panel divisions.`;
  }

  // CHI Planks — horizontal wood-grain planks
  if (styleId === "chi-planks-accents") {
    const planks = tall ? 5 : 4;
    return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. ${planks} full-width horizontal wood-grain plank sections of equal height spanning the full door width.`;
  }

  // Wayne Dalton 9100 — short/square raised panels
  if (styleId === "wayne-dalton-9100") {
    const cols = single ? 4 : 8;
    const rows = tall ? 5 : 4;
    return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. Exactly ${cols} columns × ${rows} rows of small equal-sized raised rectangular panels (${cols * rows} total) in a uniform grid — each panel is roughly square in proportion.`;
  }

  // CHI Recessed Panel — wide recessed long panels
  if (styleId === "chi-recessed-panel") {
    const cols = single ? 2 : 4;
    const rows = tall ? 5 : 4;
    return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. Exactly ${cols} wide recessed panels per row × ${rows} rows tall (${cols * rows} total), each with a deeply inset rectangular recessed field.`;
  }

  // Carriage styles — two half-width doors with center post
  if (category === "carriage") {
    const rows = tall ? 5 : 4;
    return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. Classic carriage house appearance: two equal half-width door halves meeting at a center vertical post, ${rows} horizontal sections tall, decorative strap hinges on outer edges and handles at the center meeting point.`;
  }

  // Traditional / contemporary long raised panels (default fallback)
  const cols = single ? 2 : 4;
  const rows = tall ? 5 : 4;
  return `Door opening ~${wFt}ft wide × ~${hFt}ft tall. Exactly ${cols} wide raised long panels per row × ${rows} horizontal sections tall (${cols * rows} raised panels total).`;
}

garageRouter.get("/catalog", (c) => {
  return c.json({
    data: {
      manufacturers: MANUFACTURERS,
      styles: STYLES,
    },
  });
});

// Lightweight endpoint: analyze a photo and return detected door dimensions
garageRouter.post("/detect", async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: { message: "Invalid multipart form", code: "BAD_FORM" } }, 400);
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return c.json({ error: { message: "image file required", code: "NO_IMAGE" } }, 400);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return c.json({ error: { message: "Server missing OPENAI_API_KEY", code: "NO_KEY" } }, 500);
  }
  const openaiBase = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  // Pass full resolution: detectDoor downscales for its own coarse pass but
  // crops the refine pass from the original, where the door edges are sharp.
  const rawBuffer = Buffer.from(await image.arrayBuffer());
  const processedBuffer = await sharp(rawBuffer).rotate().png().toBuffer();

  // ?debug=1 returns what each pass saw and said; ?debug=images also returns the
  // gridded PNGs — which are the customer's own photo of their house. Both are
  // gated on a secret sent in the x-debug-secret header; without it this is an
  // ordinary detection response carrying no trace and no images. See
  // ../debug-access.ts for why the gate fails closed and reads a header rather
  // than a query parameter.
  const trace = resolveTraceMode(c.req.query("debug"), c.req.header(DEBUG_SECRET_HEADER));
  const doorSize = await detectDoor(processedBuffer, openaiVision(openaiBase, openaiKey), { trace });
  return c.json({ data: doorSize });
});

garageRouter.post("/swap", async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json(
      { error: { message: "Invalid multipart form", code: "BAD_FORM" } },
      400
    );
  }

  const styleIdRaw = form.get("styleId");
  const colorIdRaw = form.get("colorId");
  const windowOptionIdRaw = form.get("windowOptionId");
  const parsed = SwapRequestFieldsSchema.safeParse({
    styleId: styleIdRaw,
    colorId: colorIdRaw ?? undefined,
    windowOptionId: windowOptionIdRaw ?? undefined,
  });
  if (!parsed.success) {
    return c.json(
      { error: { message: "styleId is required", code: "BAD_INPUT" } },
      400
    );
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return c.json(
      { error: { message: "image file is required", code: "NO_IMAGE" } },
      400
    );
  }

  const style = STYLES.find((s) => s.id === parsed.data.styleId);
  if (!style) {
    return c.json(
      { error: { message: "Unknown styleId", code: "BAD_STYLE" } },
      400
    );
  }

  // Check OpenAI key early
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return c.json(
      { error: { message: "Server missing OPENAI_API_KEY", code: "NO_KEY" } },
      500
    );
  }
  const openaiBase = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  const manufacturer = MANUFACTURERS.find((m) => m.id === style.manufacturer);
  const manufacturerName = manufacturer?.name ?? style.manufacturer;
  void manufacturerName; // used in prompt context

  const selectedColor =
    style.colors.find((c) => c.id === parsed.data.colorId) ??
    style.colors[0] ?? { id: "default", name: "Default", hex: "#FFFFFF" };
  const selectedWindow =
    style.windowOptions.find((w) => w.id === parsed.data.windowOptionId) ??
    style.windowOptions[0] ?? { id: "no-windows", name: "No Windows" };
  const noWindows =
    selectedWindow.id === "no-windows" ||
    selectedWindow.name.toLowerCase().includes("no window");

  // Convert image to PNG with EXIF rotation correction
  const rawBuffer = Buffer.from(await image.arrayBuffer());
  const tempBuffer = await sharp(rawBuffer).rotate().png().toBuffer();
  const metadata = await sharp(tempBuffer).metadata();
  const origW = metadata.width!;
  const origH = metadata.height!;
  const squareSize = Math.max(origW, origH);

  // Run image padding/resize and vision analysis in parallel
  const [pngBlob, doorSize] = await Promise.all([
    (async () => {
      let buf = await sharp(tempBuffer)
        .resize({
          width: squareSize,
          height: squareSize,
          fit: "contain",
          background: { r: 180, g: 180, b: 180, alpha: 255 },
          position: "center",
        })
        .png()
        .toBuffer();
      buf = await sharp(buf)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      return new Blob([buf], { type: "image/png" });
    })(),
    detectDoor(tempBuffer, openaiVision(openaiBase, openaiKey)),
  ]);

  const layoutDesc = buildLayoutDesc(
    style.id,
    style.category,
    doorSize.widthClass,
    doorSize.heightClass
  );

  // Compute result image size (always square; capped at 1024)
  const resultSize = Math.min(1024, squareSize);

  // Compute padding offsets added during squarification
  const padX = (squareSize - origW) / 2;
  const padY = (squareSize - origH) / 2;
  const scale = resultSize / squareSize;

  // If we have a door bbox, create the mask; otherwise skip (full image editable)
  let maskBlob: Blob | undefined;
  if (doorSize.bbox) {
    // Transform bbox from original image space to resultSize×resultSize padded space
    const bboxInResult = {
      x: (doorSize.bbox.x * origW + padX) * scale,
      y: (doorSize.bbox.y * origH + padY) * scale,
      w: doorSize.bbox.w * origW * scale,
      h: doorSize.bbox.h * origH * scale,
    };
    // Normalize back to fractions for createDoorMask
    const bboxNorm = {
      x: bboxInResult.x / resultSize,
      y: bboxInResult.y / resultSize,
      w: bboxInResult.w / resultSize,
      h: bboxInResult.h / resultSize,
    };
    const maskBuffer = await createDoorMask(resultSize, resultSize, bboxNorm);
    maskBlob = new Blob([maskBuffer], { type: "image/png" });
  }

  const prompt = [
    `Replace the garage door panels with: ${style.prompt}.`,
    `DOOR DIMENSIONS & LAYOUT: ${layoutDesc}`,
    `Color/finish: ${selectedColor.name}.`,
    noWindows ? `No windows on the door.` : `Window style: ${selectedWindow.name}.`,
    `The new door must fit precisely within the existing door opening, matching the perspective, vanishing point, and proportions of the original photo.`,
    `Preserve all original lighting, shadows, and ambient light — only the door surface itself reflects new lighting.`,
  ].join(" ");

  // Forward to OpenAI image edit API (gpt-image-1)
  const openaiForm = new FormData();
  openaiForm.append("image", pngBlob, "house.png");
  if (maskBlob) {
    openaiForm.append("mask", maskBlob, "mask.png");
  }
  openaiForm.append("prompt", prompt);
  openaiForm.append("model", "gpt-image-1");
  openaiForm.append("n", "1");
  openaiForm.append("size", "1024x1024");
  openaiForm.append("quality", "low");

  let resp: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  try {
    resp = await fetch(`${openaiBase}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: openaiForm,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[garage/swap] OpenAI request timed out after 90s");
      return c.json(
        { error: { message: "Image generation timed out — please try again", code: "TIMEOUT" } },
        504
      );
    }
    console.error("[garage/swap] fetch failed", err);
    return c.json(
      { error: { message: "Image service unreachable", code: "UPSTREAM_DOWN" } },
      502
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("[garage/swap] OpenAI error", resp.status, text);
    return c.json(
      {
        error: {
          message: `Image generation failed (${resp.status})`,
          code: "UPSTREAM_ERROR",
          detail: text.slice(0, 500),
        },
      },
      502
    );
  }

  const json = (await resp.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = json.data?.[0];
  if (!first?.b64_json && !first?.url) {
    return c.json(
      { error: { message: "No image returned", code: "EMPTY_RESULT" } },
      502
    );
  }

  let doorCenterXPct: number | undefined = undefined;
  let imageBase64 = first.b64_json;
  if (!imageBase64 && first.url) {
    try {
      const imgResp = await fetch(first.url);
      const buf = await imgResp.arrayBuffer();
      imageBase64 = Buffer.from(buf).toString("base64");
    } catch (err) {
      console.error("[garage/swap] could not fetch returned URL", err);
      return c.json(
        { error: { message: "Could not retrieve image", code: "FETCH_FAIL" } },
        502
      );
    }
  }

  // Crop result back to original aspect ratio
  if (imageBase64) {
    const resultBuffer = Buffer.from(imageBase64, "base64");
    const resultMeta = await sharp(resultBuffer).metadata();
    const actualResultSize = resultMeta.width!;

    const cropW = Math.round((origW / squareSize) * actualResultSize);
    const cropH = Math.round((origH / squareSize) * actualResultSize);
    const cropX = Math.round((actualResultSize - cropW) / 2);
    const cropY = Math.round((actualResultSize - cropH) / 2);

    const croppedBuffer = await sharp(resultBuffer)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .png()
      .toBuffer();

    imageBase64 = croppedBuffer.toString("base64");

    // Restore original pixels outside the door region to prevent color tinting
    const origResizedBuffer = await sharp(tempBuffer)
      .resize({ width: cropW, height: cropH, fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const aiResizedBuffer = await sharp(croppedBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width: rW, height: rH } = origResizedBuffer.info;
    const origPx = origResizedBuffer.data;
    const aiPx = aiResizedBuffer.data;

    // -----------------------------------------------------------------------
    // Composite the AI result back over the ORIGINAL photo.
    //
    // gpt-image-1's /images/edits endpoint regenerates the whole frame, so the
    // returned image carries the new door AND a subtly re-rendered sky,
    // driveway, roofline and planting. Only the door is wanted.
    //
    // Find what changed and keep exactly that. The model draws the door where
    // the door belongs — it can see the whole house — so the bounding box of
    // changed pixels IS the door region, discovered rather than predicted.
    //
    // This is the original approach, restored. It was replaced by clipping to a
    // separately detected box, on the theory that a tighter bound would stop
    // the surrounding hallucination. It did, and it also broke placement:
    // bounding the edit to a guessed rectangle turned every error in that guess
    // into a misplaced door rather than a stray cloud. Constraining the model
    // made the result worse. Small invented detail in the surroundings is the
    // accepted cost of the door landing in the doorway.
    //
    // The boundary needs no feathering. The box is drawn exactly where the two
    // images stop differing, so along its edge they agree to within
    // DOOR_THRESHOLD and a hard cut is invisible. Feathering is only needed
    // when the cut lands somewhere the two genuinely disagree.
    // -----------------------------------------------------------------------
    const DOOR_THRESHOLD = 45;
    let x1 = rW, x2 = 0, y1 = rH, y2 = 0;
    for (let y = 0; y < rH; y++) {
      for (let x = 0; x < rW; x++) {
        const i = (y * rW + x) * 4;
        const diff = Math.max(
          Math.abs((origPx[i] ?? 0) - (aiPx[i] ?? 0)),
          Math.abs((origPx[i + 1] ?? 0) - (aiPx[i + 1] ?? 0)),
          Math.abs((origPx[i + 2] ?? 0) - (aiPx[i + 2] ?? 0))
        );
        if (diff > DOOR_THRESHOLD) {
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        }
      }
    }

    if (x1 < x2 && y1 < y2) {
      doorCenterXPct = (x1 + x2) / 2 / rW;
      const margin = Math.round(Math.min(rW, rH) * 0.015);
      x1 = Math.max(0, x1 - margin);
      y1 = Math.max(0, y1 - margin);
      x2 = Math.min(rW - 1, x2 + margin);
      y2 = Math.min(rH - 1, y2 + margin);

      const outPx = Buffer.alloc(rW * rH * 4);
      for (let y = 0; y < rH; y++) {
        for (let x = 0; x < rW; x++) {
          const i = (y * rW + x) * 4;
          const inDoor = x >= x1 && x <= x2 && y >= y1 && y <= y2;
          const src = inDoor ? aiPx : origPx;
          outPx[i] = src[i] ?? 0;
          outPx[i + 1] = src[i + 1] ?? 0;
          outPx[i + 2] = src[i + 2] ?? 0;
          outPx[i + 3] = 255;
        }
      }

      const finalBuffer = await sharp(outPx, {
        raw: { width: rW, height: rH, channels: 4 },
      })
        .png()
        .toBuffer();

      imageBase64 = finalBuffer.toString("base64");
    }
  }

  return c.json({
    data: {
      imageBase64,
      styleId: style.id,
      generatedAt: new Date().toISOString(),
      doorCenterXPct,
      detectedDoorSize: doorSize,
    },
  });
});

export { garageRouter };
