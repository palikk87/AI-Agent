import sharp from "sharp";

// ---------------------------------------------------------------------------
// Garage door localisation.
//
// History, because it explains the shape of this file:
//
// v1 asked gpt-4o-mini for {x,y,w,h} fractions and put a fully-populated example
// object in the prompt. The model copied the example almost verbatim on every
// photo. v2 removed the example, switched to gpt-4o at detail:"high", and asked
// for edges one at a time. That killed the copying — boxes finally varied per
// photo — but the boxes were still wrong, because it left the underlying
// assumption untouched: that a chat VLM can regress pixel coordinates. It
// cannot. Measured output was quantised to round numbers (0.05, 0.1, 0.3, 0.8)
// and on a two-door house it returned a strip across the tops of BOTH doors.
//
// So stop asking for coordinates. Draw a labelled grid on the image and ask
// which labelled cells the door covers — multiple choice over visible anchors
// instead of coordinate regression. That is the one question form these models
// are reliably good at.
//
// Two passes, because one grid cannot be both coarse enough to read and fine
// enough to be accurate:
//   1. coarse grid over the whole photo  -> which door, roughly where
//   2. fine grid over a crop around it   -> where its four edges actually are
//
// Every pass is validated, and every failure degrades to the pass before it
// rather than to a guess.
// ---------------------------------------------------------------------------

export type DoorBox = { x: number; y: number; w: number; h: number };

export type DoorDetection = {
  widthClass: "single" | "double";
  heightClass: "standard" | "tall";
  bbox?: DoorBox;
  /** How the box was arrived at — surfaced in the API for debugging. */
  stage: "refined" | "coarse" | "none";
  /** Populated only when explicitly requested; see DetectOptions.trace. */
  trace?: DoorTrace;
};

/**
 * Everything the two passes saw and said. Offline tests cannot catch a fault in
 * how the grid is *drawn* — their oracle computes cell references rather than
 * reading the rendered labels — so being able to pull the exact images the model
 * was shown, alongside its replies, is the only way to tell a rendering fault
 * apart from a judgement one.
 */
export type DoorTrace = {
  coarseReply?: Record<string, unknown>;
  coarseBox?: DoorBox;
  crop?: DoorBox;
  centre?: { x: number; y: number };
  fineReply?: Record<string, unknown>;
  fineBox?: DoorBox;
  /** base64 PNGs of the gridded images actually sent to the model. */
  coarseImage?: string;
  fineImage?: string;
  /** False means grid labels are blank and any box here is worthless. */
  fontsUsable?: boolean;
};

export type DetectOptions = {
  /** Collect intermediate state. `images` also returns the gridded PNGs. */
  trace?: boolean | "images";
};

export const COL_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");

export const COARSE_COLS = 12;
export const COARSE_ROWS = 8;
export const FINE_COLS = 12;
export const FINE_ROWS = 12;

/** Longest edge, in px, of the images sent to the vision model. */
const VISION_PX = 768;

/**
 * How far the refine crop reaches beyond the coarse box, as a fraction of it.
 * Generous on purpose: if the true door falls outside the crop, the refine pass
 * can only report an edge at the crop boundary, which turns a coarse-pass miss
 * into a confidently wrong refined box.
 */
const CROP_MARGIN = 0.35;

export const DOOR_VISION_MODEL = process.env.DOOR_VISION_MODEL || "gpt-4o";

// --- font sanity -----------------------------------------------------------

/**
 * Confirm the platform can actually draw text into an SVG.
 *
 * This is not hypothetical. The production image shipped with no fonts
 * installed, so every grid label rendered as an empty tofu box. The photos
 * reaching the model carried gridlines and no readable references at all, and
 * detection quietly degraded to guessing — while rendering perfectly on every
 * development machine. A missing font is invisible in the output unless
 * something goes looking for it, so this goes looking for it.
 */
export async function textRenders(): Promise<boolean> {
  try {
    const svg = Buffer.from(
      `<svg width="80" height="40"><rect width="80" height="40" fill="#000"/>` +
        `<text x="4" y="30" font-family="sans-serif" font-size="30" fill="#fff">A8</text></svg>`
    );
    const { data } = await sharp(svg).greyscale().raw().toBuffer({ resolveWithObject: true });
    // Glyph strokes should light up a healthy number of pixels; tofu boxes and a
    // blank canvas both leave far fewer.
    let ink = 0;
    for (const v of data) if (v > 128) ink++;
    return ink > 60;
  } catch {
    return false;
  }
}

let fontCheck: Promise<boolean> | undefined;
/** Memoised so the check runs once per process, not once per request. */
export function fontsUsable(): Promise<boolean> {
  if (!fontCheck) {
    fontCheck = textRenders().then((ok) => {
      if (!ok) {
        console.error(
          "[door-detect] FONT FAILURE: SVG text is not rendering, so grid labels are blank. " +
            "Door detection cannot work. Install fonts in the runtime image (see Dockerfile)."
        );
      }
      return ok;
    });
  }
  return fontCheck;
}

// --- grid rendering --------------------------------------------------------

/**
 * Overlay a labelled grid. Every cell carries its own label so the model never
 * has to count gridlines back to an edge, and the four edge rulers mean a label
 * is always near the door wherever in the frame it sits.
 */
export async function renderGrid(
  input: Buffer,
  cols: number,
  rows: number,
  marker?: { x: number; y: number }
): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const cw = W / cols;
  const ch = H / rows;
  const parts: string[] = [];

  const fs = Math.max(9, Math.round(Math.min(cw, ch) * 0.3));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      parts.push(
        `<text x="${c * cw + cw / 2}" y="${r * ch + ch / 2}" font-family="sans-serif" font-size="${fs}" ` +
          `fill="#FF00FF" fill-opacity="0.85" text-anchor="middle" dominant-baseline="central" ` +
          `stroke="#000" stroke-width="0.6" paint-order="stroke">${COL_LABELS[c]}${r + 1}</text>`
      );
    }
  }

  for (let c = 1; c < cols; c++) {
    parts.push(
      `<line x1="${c * cw}" y1="0" x2="${c * cw}" y2="${H}" stroke="#FF00FF" stroke-opacity="0.45" stroke-width="1"/>`
    );
  }
  for (let r = 1; r < rows; r++) {
    parts.push(
      `<line x1="0" y1="${r * ch}" x2="${W}" y2="${r * ch}" stroke="#FF00FF" stroke-opacity="0.45" stroke-width="1"/>`
    );
  }

  const es = Math.max(11, Math.round(Math.min(cw, ch) * 0.42));
  for (let c = 0; c < cols; c++) {
    const x = c * cw + cw / 2;
    for (const [ty, by] of [
      [es + 2, 0],
      [H - 3, H - es - 5],
    ]) {
      parts.push(
        `<rect x="${x - es * 0.6}" y="${by}" width="${es * 1.2}" height="${es + 4}" fill="#000" fill-opacity="0.65"/>`
      );
      parts.push(
        `<text x="${x}" y="${ty}" font-family="sans-serif" font-size="${es}" fill="#0FF" text-anchor="middle" font-weight="bold">${COL_LABELS[c]}</text>`
      );
    }
  }
  for (let r = 0; r < rows; r++) {
    const y = r * ch + ch / 2;
    for (const [tx, bx] of [
      [es * 0.7, 0],
      [W - es * 0.7, W - es * 1.4],
    ]) {
      parts.push(
        `<rect x="${bx}" y="${y - es * 0.6}" width="${es * 1.4}" height="${es + 2}" fill="#000" fill-opacity="0.65"/>`
      );
      parts.push(
        `<text x="${tx}" y="${y}" font-family="sans-serif" font-size="${es}" fill="#0FF" text-anchor="middle" dominant-baseline="central" font-weight="bold">${r + 1}</text>`
      );
    }
  }

  // Marker identifying which door to measure. A crop sized to one door routinely
  // catches its neighbour, and words alone ("the door in the middle") do not
  // reliably beat the model's pull toward bounding everything door-like it can
  // see — on a two-door house it returned one box spanning both. Pointing at the
  // door is the same trick as the grid: put the reference in the image.
  if (marker) {
    const r = Math.max(10, Math.round(Math.min(W, H) * 0.045));
    const mx = marker.x * W;
    const my = marker.y * H;
    parts.push(
      `<circle cx="${mx}" cy="${my}" r="${r}" fill="none" stroke="#00FF00" stroke-width="4"/>`,
      `<circle cx="${mx}" cy="${my}" r="${Math.round(r * 0.16)}" fill="#00FF00"/>`,
      `<line x1="${mx - r * 1.6}" y1="${my}" x2="${mx - r * 1.15}" y2="${my}" stroke="#00FF00" stroke-width="4"/>`,
      `<line x1="${mx + r * 1.15}" y1="${my}" x2="${mx + r * 1.6}" y2="${my}" stroke="#00FF00" stroke-width="4"/>`,
      `<line x1="${mx}" y1="${my - r * 1.6}" x2="${mx}" y2="${my - r * 1.15}" stroke="#00FF00" stroke-width="4"/>`,
      `<line x1="${mx}" y1="${my + r * 1.15}" x2="${mx}" y2="${my + r * 1.6}" stroke="#00FF00" stroke-width="4"/>`
    );
  }

  const svg = Buffer.from(`<svg width="${W}" height="${H}">${parts.join("")}</svg>`);
  return sharp(input).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
}

// --- parsing ---------------------------------------------------------------

/** "C" | "c" | "C7" -> 2. Returns -1 for anything unparseable. */
export function colIndex(v: unknown): number {
  if (typeof v !== "string" || !v.length) return -1;
  const i = COL_LABELS.indexOf(v.trim()[0]!.toUpperCase());
  return i;
}

/** 7 | "7" | "C7" -> 6 (zero-based). Returns -1 for anything unparseable. */
export function rowIndex(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v) - 1;
  if (typeof v !== "string") return -1;
  const m = v.match(/\d+/);
  return m ? Number(m[0]) - 1 : -1;
}

/**
 * Reject boxes that cannot be a garage door.
 *
 * These guards only catch degenerate geometry. They deliberately do NOT try to
 * catch a plausibly-shaped box in the wrong place — nothing about the numbers
 * alone can tell you that, and pretending otherwise is how v2 shipped looking
 * validated. Correct placement is the job of the two-pass detection above.
 */
export function validateDoorBox(
  left: number,
  right: number,
  top: number,
  bottom: number
): DoorBox | undefined {
  if (![left, right, top, bottom].every((v) => Number.isFinite(v))) return undefined;

  const x1 = Math.max(0, Math.min(1, Math.min(left, right)));
  const x2 = Math.max(0, Math.min(1, Math.max(left, right)));
  const y1 = Math.max(0, Math.min(1, Math.min(top, bottom)));
  const y2 = Math.max(0, Math.min(1, Math.max(top, bottom)));

  const w = x2 - x1;
  const h = y2 - y1;

  if (w < 0.05 || h < 0.05) return undefined; // too small to be a door
  if (w > 0.98 && h > 0.98) return undefined; // whole frame — not a detection
  if (w * h > 0.85) return undefined; // implausibly large
  if (w / h > 8 || h / w > 8) return undefined; // a garage door is not a sliver

  return { x: x1, y: y1, w, h };
}

// --- prompts ---------------------------------------------------------------

const COARSE_PROMPT = [
  "This photo of a house has a labelled grid drawn over it. Columns are lettered",
  `A-${COL_LABELS[COARSE_COLS - 1]} left to right; rows are numbered 1-${COARSE_ROWS} top to bottom.`,
  "Every cell is labelled with its own reference, e.g. C4.",
  "",
  "Find the garage door. If the house has more than one, pick the single widest",
  "one and ignore the others entirely.",
  "",
  "Report which grid cells that one door covers. Judge the door opening itself,",
  "including its frame and trim, and nothing else — not the driveway below it,",
  "not the wall or siding beside it, not the roof above it.",
  "",
  "leftCol and rightCol must bracket only the door you name in `where`. If they",
  "span two doors, or a door plus the wall next to it, they are wrong.",
  "For bottomRow, use where the door meets the ground, not the lowest panel seam.",
  "",
  "Reply with JSON only, no prose and no markdown fence, with these keys:",
  '  doorCount   - how many separate garage doors you can see (number)',
  '  where       - one short sentence naming the door you chose and what is',
  "                immediately left and right of it, so your choice is checkable",
  '  centreCell  - the single cell at the middle of the door you chose, e.g. F6',
  '  leftCol     - column letter where the door\'s left edge falls',
  '  rightCol    - column letter where the door\'s right edge falls',
  '  topRow      - row number where the top of the door frame falls',
  '  bottomRow   - row number where the door meets the ground',
  '  widthClass  - "single" for a one-car door, "double" for a two-car door',
  '  heightClass - "standard" for a roughly 7ft door, "tall" for 8ft or more',
  "",
  "Write `where` before the cell keys, and make the cell keys agree with it.",
  "If there is no garage door at all, set leftCol, rightCol, topRow and bottomRow to null.",
].join("\n");

const FINE_PROMPT = [
  "This is a close crop around one garage door, with a labelled grid drawn over it.",
  `Columns are lettered A-${COL_LABELS[FINE_COLS - 1]} left to right; rows are numbered 1-${FINE_ROWS} top to bottom.`,
  "",
  "A green circular marker is drawn on the door you must measure.",
  "",
  "IMPORTANT: a neighbouring garage door is often partly visible near the left or",
  "right edge of this crop. Ignore it completely. Measure only the one door under",
  "the green marker. Your box must stop at that door's own frame — if it contains",
  "two doors, or a door and part of another, it is wrong.",
  "",
  "Locate that door's four outer edges, including its frame and trim.",
  "For each edge, name the single grid cell the edge passes through.",
  "",
  "Reply with JSON only, no prose and no markdown fence, with these keys:",
  '  leftCol   - column letter the door\'s left edge passes through',
  '  rightCol  - column letter the door\'s right edge passes through',
  '  topRow    - row number the top of the door frame passes through',
  '  bottomRow - row number where the bottom of the door meets the ground',
  "",
  "For bottomRow, find where the door panel actually ends and the driveway begins.",
  "Do not carry on down into the driveway, its apron, or the shadow in front of",
  "the door. Equally, do not stop at the lowest panel seam — the door continues",
  "below it to the ground.",
  "",
  "If there is no garage door under the marker, set all four to null.",
].join("\n");

// --- vision plumbing -------------------------------------------------------

export type VisionCaller = (imageBase64: string, prompt: string) => Promise<string>;

/** Default caller: OpenAI chat completions, forced to JSON, deterministic. */
export function openaiVision(openaiBase: string, openaiKey: string): VisionCaller {
  return async (imageBase64, prompt) => {
    const resp = await fetch(`${openaiBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DOOR_VISION_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "high" },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`vision ${resp.status}: ${body.slice(0, 200)}`);
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "{}";
  };
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw.trim().replace(/```json\n?|\n?```/g, "").trim()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// --- detection -------------------------------------------------------------

/**
 * Convert an inclusive cell range to a normalised box.
 *
 * A cell range is a span, not a point: the left edge lies somewhere inside the
 * leftmost cell and the right edge somewhere inside the rightmost. Taking each
 * cell's centre is the lowest-expected-error read of that, and it stops boxes
 * inflating by a full cell on each side the way a naive outer-bounds read does.
 */
export function cellsToBox(
  leftCol: number,
  rightCol: number,
  topRow: number,
  bottomRow: number,
  cols: number,
  rows: number
): DoorBox | undefined {
  if (leftCol < 0 || rightCol < 0 || topRow < 0 || bottomRow < 0) return undefined;
  if (leftCol >= cols || rightCol >= cols || topRow >= rows || bottomRow >= rows) return undefined;

  const cw = 1 / cols;
  const ch = 1 / rows;
  const l = (Math.min(leftCol, rightCol) + 0.5) * cw;
  const r = (Math.max(leftCol, rightCol) + 0.5) * cw;
  const t = (Math.min(topRow, bottomRow) + 0.5) * ch;
  const b = (Math.max(topRow, bottomRow) + 0.5) * ch;

  return validateDoorBox(l, r, t, b);
}

/**
 * Centre point of a cell reference like "F6", as fractions of the image.
 * Returns undefined if either half is unparseable or out of range.
 */
export function centreOfCell(
  ref: unknown,
  cols: number,
  rows: number
): { x: number; y: number } | undefined {
  const c = colIndex(ref);
  const r = rowIndex(ref);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return undefined;
  return { x: (c + 0.5) / cols, y: (r + 0.5) / rows };
}

/** Grow a box by `pad` of its own size, clamped to the frame. */
export function expandBox(b: DoorBox, pad: number): DoorBox {
  const x = Math.max(0, b.x - b.w * pad);
  const y = Math.max(0, b.y - b.h * pad);
  return {
    x,
    y,
    w: Math.min(1 - x, b.w * (1 + pad * 2)),
    h: Math.min(1 - y, b.h * (1 + pad * 2)),
  };
}

/** Widen a box just enough to contain `p`, with a little slack, clamped to the frame. */
export function includePoint(b: DoorBox, p: { x: number; y: number }): DoorBox {
  const slack = 0.02;
  const x1 = Math.max(0, Math.min(b.x, p.x - slack));
  const y1 = Math.max(0, Math.min(b.y, p.y - slack));
  const x2 = Math.min(1, Math.max(b.x + b.w, p.x + slack));
  const y2 = Math.min(1, Math.max(b.y + b.h, p.y + slack));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Map a box expressed inside `crop` back into full-image coordinates. */
export function boxFromCrop(inner: DoorBox, crop: DoorBox): DoorBox {
  return {
    x: crop.x + inner.x * crop.w,
    y: crop.y + inner.y * crop.h,
    w: inner.w * crop.w,
    h: inner.h * crop.h,
  };
}

/**
 * Locate the garage door. Never throws: on any failure it returns the best
 * result it reached, and `stage` says how far it got.
 */
export async function detectDoor(
  image: Buffer,
  vision: VisionCaller,
  opts: DetectOptions = {}
): Promise<DoorDetection> {
  const trace: DoorTrace | undefined = opts.trace ? {} : undefined;
  const keepImages = opts.trace === "images";
  const fallback: DoorDetection = { widthClass: "double", heightClass: "standard", stage: "none", trace };

  const fontsOk = await fontsUsable();
  if (trace) trace.fontsUsable = fontsOk;

  let coarse: Record<string, unknown>;
  try {
    // Coarse pass only has to find the door, so a downscaled copy is plenty and
    // keeps the request small.
    const small = await sharp(image)
      .resize({ width: VISION_PX, height: VISION_PX, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const gridded = await renderGrid(small, COARSE_COLS, COARSE_ROWS);
    if (trace && keepImages) trace.coarseImage = gridded.toString("base64");
    coarse = parseJson(await vision(gridded.toString("base64"), COARSE_PROMPT));
    if (trace) trace.coarseReply = coarse;
  } catch (err) {
    console.warn("[door-detect] coarse pass failed:", err);
    return fallback;
  }

  const widthClass = coarse.widthClass === "single" ? "single" : "double";
  const heightClass = coarse.heightClass === "tall" ? "tall" : "standard";
  const base: DoorDetection = { widthClass, heightClass, stage: "none", trace };

  const coarseBox = cellsToBox(
    colIndex(coarse.leftCol),
    colIndex(coarse.rightCol),
    rowIndex(coarse.topRow),
    rowIndex(coarse.bottomRow),
    COARSE_COLS,
    COARSE_ROWS
  );

  if (!coarseBox) {
    console.warn("[door-detect] no usable coarse box:", JSON.stringify(coarse).slice(0, 200));
    return base;
  }
  if (trace) trace.coarseBox = coarseBox;
  console.info(
    `[door-detect] coarse ${JSON.stringify(coarseBox)} doorCount=${coarse.doorCount} where=${String(coarse.where).slice(0, 120)}`
  );

  const centre = centreOfCell(coarse.centreCell, COARSE_COLS, COARSE_ROWS) ?? {
    x: coarseBox.x + coarseBox.w / 2,
    y: coarseBox.y + coarseBox.h / 2,
  };

  // Refine against a crop. The margin gives the model room to see the real
  // edges even when the coarse box clipped them, and the crop is widened again
  // if needed so the marked centre is always inside it — a marker outside the
  // crop cannot point at anything.
  const crop = includePoint(expandBox(coarseBox, CROP_MARGIN), centre);
  if (trace) {
    trace.crop = crop;
    trace.centre = centre;
  }
  try {
    const meta = await sharp(image).metadata();
    const W = meta.width!;
    const H = meta.height!;
    // Crop from the full-resolution original, not the downscaled coarse copy —
    // this pass is the one that needs to see the actual door edges. Enlargement
    // is deliberately allowed: a small crop upscaled to VISION_PX gains no
    // detail, but it does keep the finer grid's labels legible.
    const cropped = await sharp(image)
      .extract({
        left: Math.round(crop.x * W),
        top: Math.round(crop.y * H),
        width: Math.max(1, Math.round(crop.w * W)),
        height: Math.max(1, Math.round(crop.h * H)),
      })
      .resize({ width: VISION_PX, height: VISION_PX, fit: "inside" })
      .png()
      .toBuffer();

    // Mark the coarse pass's door inside the crop, so the refine pass measures
    // the door the coarse pass chose rather than whatever else is in frame.
    //
    // Prefer the explicitly reported centre cell over the centre of the coarse
    // box. Naming one cell is a far easier judgement than placing four edges,
    // and when the two disagree it is the box that is usually wrong: on a
    // two-door house the box spanned both doors, putting its centre on the post
    // between them — a marker there points at no door at all.
    const marker = {
      x: (centre.x - crop.x) / crop.w,
      y: (centre.y - crop.y) / crop.h,
    };
    const gridded = await renderGrid(cropped, FINE_COLS, FINE_ROWS, marker);
    if (trace && keepImages) trace.fineImage = gridded.toString("base64");
    const fine = parseJson(await vision(gridded.toString("base64"), FINE_PROMPT));
    if (trace) trace.fineReply = fine;

    const innerBox = cellsToBox(
      colIndex(fine.leftCol),
      colIndex(fine.rightCol),
      rowIndex(fine.topRow),
      rowIndex(fine.bottomRow),
      FINE_COLS,
      FINE_ROWS
    );
    if (innerBox) {
      if (trace) trace.fineBox = innerBox;
      const refined = boxFromCrop(innerBox, crop);
      const checked = validateDoorBox(refined.x, refined.x + refined.w, refined.y, refined.y + refined.h);
      if (checked) {
        console.info(`[door-detect] refined ${JSON.stringify(checked)}`);
        return { ...base, bbox: checked, stage: "refined" };
      }
    }
    console.warn("[door-detect] refine pass unusable, keeping coarse box:", JSON.stringify(fine).slice(0, 200));
  } catch (err) {
    console.warn("[door-detect] refine pass failed, keeping coarse box:", err);
  }

  return { ...base, bbox: coarseBox, stage: "coarse" };
}
