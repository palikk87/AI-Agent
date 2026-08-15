import { Hono } from "hono";
import sharp from "sharp";
import { detectDoor, openaiVision } from "../door-detect";
import { MANUFACTURERS, STYLES, SwapRequestFieldsSchema } from "../types";

const garageRouter = new Hono();

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

// Creates a mask PNG: opaque white everywhere except the door area (transparent).
// Transparent pixels = AI may edit; opaque pixels = AI must preserve.
async function createDoorMask(
  width: number,
  height: number,
  bbox: { x: number; y: number; w: number; h: number }
): Promise<Buffer> {
  // Add 5% padding around the bbox for safety (in case bbox is slightly tight)
  const padW = Math.round(bbox.w * width * 0.05);
  const padH = Math.round(bbox.h * height * 0.05);
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
  // gridded PNGs. Diagnostic only — the normal response is unchanged.
  const debug = c.req.query("debug");
  const doorSize = await detectDoor(processedBuffer, openaiVision(openaiBase, openaiKey), {
    trace: debug === "images" ? "images" : debug ? true : undefined,
  });
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
    // gpt-image-1's /images/edits endpoint REGENERATES THE WHOLE IMAGE. Unlike
    // classic inpainting it does not preserve pixels outside the mask — it
    // re-renders the entire scene, altering sky, driveway, landscaping, roofline
    // and trim. That is the "hallucinated surroundings" problem.
    //
    // The original implementation tried to recover by DIFFING original against
    // AI output and taking the bounding box of everything that changed. That
    // fails by construction: because the model changes the whole frame, the diff
    // finds changes everywhere, the box balloons to nearly the full image, and
    // essentially all of the hallucinated scene is kept.
    //
    // Instead, use the door box we already detected for the mask. AI pixels
    // strictly inside it, original pixels everywhere else — so hallucination
    // outside the door is impossible rather than merely unlikely.
    // -----------------------------------------------------------------------
    const bb = doorSize.bbox;
    if (bb) {
      let x1 = Math.round(bb.x * rW);
      let y1 = Math.round(bb.y * rH);
      let x2 = Math.round((bb.x + bb.w) * rW);
      let y2 = Math.round((bb.y + bb.h) * rH);

      doorCenterXPct = (x1 + x2) / 2 / rW;

      // Small outward margin so trim and the shadow line at the door edge come
      // along with the door rather than being cut off mid-detail.
      const margin = Math.round(Math.min(rW, rH) * 0.012);
      x1 = Math.max(0, x1 - margin);
      y1 = Math.max(0, y1 - margin);
      x2 = Math.min(rW - 1, x2 + margin);
      y2 = Math.min(rH - 1, y2 + margin);

      // Blend across a few pixels at the boundary. A hard cut leaves a visible
      // rectangle outline wherever the AI's exposure differs from the photo's.
      const feather = Math.max(2, Math.round(Math.min(rW, rH) * 0.006));

      const outPx = Buffer.alloc(rW * rH * 4);
      for (let y = 0; y < rH; y++) {
        for (let x = 0; x < rW; x++) {
          const i = (y * rW + x) * 4;

          // How far inside the door box this pixel sits (negative = outside).
          const edge = Math.min(x - x1, x2 - x, y - y1, y2 - y);

          let alpha: number;
          if (edge < 0) alpha = 0;                  // outside -> original only
          else if (edge >= feather) alpha = 1;      // well inside -> AI only
          else alpha = edge / feather;              // boundary -> blend

          if (alpha <= 0) {
            outPx[i] = origPx[i] ?? 0;
            outPx[i + 1] = origPx[i + 1] ?? 0;
            outPx[i + 2] = origPx[i + 2] ?? 0;
          } else if (alpha >= 1) {
            outPx[i] = aiPx[i] ?? 0;
            outPx[i + 1] = aiPx[i + 1] ?? 0;
            outPx[i + 2] = aiPx[i + 2] ?? 0;
          } else {
            const inv = 1 - alpha;
            outPx[i] = Math.round((aiPx[i] ?? 0) * alpha + (origPx[i] ?? 0) * inv);
            outPx[i + 1] = Math.round((aiPx[i + 1] ?? 0) * alpha + (origPx[i + 1] ?? 0) * inv);
            outPx[i + 2] = Math.round((aiPx[i + 2] ?? 0) * alpha + (origPx[i + 2] ?? 0) * inv);
          }
          outPx[i + 3] = 255;
        }
      }

      const finalBuffer = await sharp(outPx, {
        raw: { width: rW, height: rH, channels: 4 },
      })
        .png()
        .toBuffer();

      imageBase64 = finalBuffer.toString("base64");
    } else {
      // No door box means we cannot bound the edit. Returning the raw AI image
      // would hand back a re-rendered scene, so say so in the logs rather than
      // guessing a region.
      console.warn("[garage/swap] no door box detected; returning ungated AI result");
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
