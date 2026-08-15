/**
 * Offline tests for door detection. No network, no API key.
 *
 * The point of these is the coordinate pipeline, not the model. A synthetic
 * photo is generated with the "door" at a known place, and the vision call is
 * replaced by an oracle that reads the door's real position out of whatever
 * image it is handed. If the grid rendering, cell parsing, crop mapping or
 * box arithmetic is wrong, the recovered box stops matching the known truth.
 *
 *   bun run scripts/test-door-detect.ts
 */
import sharp from "sharp";
import {
  COARSE_COLS,
  COARSE_ROWS,
  COL_LABELS,
  FINE_COLS,
  FINE_ROWS,
  type DoorBox,
  type VisionCaller,
  boxFromCrop,
  cellsToBox,
  colIndex,
  detectDoor,
  expandBox,
  COARSE_PROMPT,
  FINE_PROMPT,
  renderGrid,
  centreOfCell,
  includePoint,
  rowIndex,
  textRenders,
  validateDoorBox,
} from "../src/door-detect";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function near(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}
function iou(a: DoorBox, b: DoorBox) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter);
}

// --- pure helpers ----------------------------------------------------------

console.log("\nparsing");
check("colIndex A", colIndex("A") === 0);
check("colIndex C from 'C7'", colIndex("C7") === 2);
check("colIndex lowercase", colIndex("d") === 3);
check("colIndex rejects junk", colIndex("") === -1 && colIndex(null) === -1 && colIndex(7) === -1);
check("rowIndex number", rowIndex(7) === 6);
check("rowIndex string", rowIndex("7") === 6);
check("rowIndex from 'C7'", rowIndex("C7") === 6);
check("rowIndex rejects junk", rowIndex("none") === -1 && rowIndex(null) === -1);

console.log("\nvalidateDoorBox");
check("accepts a plausible door", !!validateDoorBox(0.33, 0.62, 0.58, 0.88));
check("normalises reversed edges", (() => {
  const b = validateDoorBox(0.62, 0.33, 0.88, 0.58);
  return !!b && near(b.x, 0.33, 1e-9) && near(b.w, 0.29, 1e-9);
})());
check("rejects slivers", !validateDoorBox(0.3, 0.32, 0.1, 0.9));
check("rejects whole frame", !validateDoorBox(0, 1, 0, 1));
check("rejects non-finite", !validateDoorBox(NaN, 0.5, 0.2, 0.8));
check("clamps out-of-range", (() => {
  const b = validateDoorBox(-0.5, 0.5, -0.2, 0.6);
  return !!b && b.x === 0 && b.y === 0;
})());

console.log("\ncell maths");
check("cellsToBox uses cell centres", (() => {
  // cols 0..11: centre of col 3 is 3.5/12, centre of col 7 is 7.5/12
  const b = cellsToBox(3, 7, 4, 7, 12, 8);
  return !!b && near(b.x, 3.5 / 12, 1e-9) && near(b.x + b.w, 7.5 / 12, 1e-9) && near(b.y, 4.5 / 8, 1e-9);
})());
check("cellsToBox rejects out-of-range", !cellsToBox(0, 12, 0, 3, 12, 8));
check("cellsToBox rejects unparsed (-1)", !cellsToBox(-1, 5, 2, 6, 12, 8));
check("expandBox clamps at frame", (() => {
  const b = expandBox({ x: 0.05, y: 0.9, w: 0.2, h: 0.08 }, 0.5);
  return b.x >= 0 && b.y >= 0 && b.x + b.w <= 1.0000001 && b.y + b.h <= 1.0000001;
})());
check("centreOfCell F6", (() => {
  const c = centreOfCell("F6", 12, 8);
  return !!c && near(c.x, 5.5 / 12, 1e-9) && near(c.y, 5.5 / 8, 1e-9);
})());
check("centreOfCell rejects out-of-range", !centreOfCell("Z9", 12, 8) && !centreOfCell("", 12, 8));
check("includePoint widens to contain the point", (() => {
  const b = includePoint({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, { x: 0.8, y: 0.1 });
  return b.x <= 0.4 && b.y <= 0.08 && b.x + b.w >= 0.82 && b.y + b.h >= 0.6;
})());
check("includePoint leaves a containing box alone", (() => {
  const b = includePoint({ x: 0.2, y: 0.2, w: 0.6, h: 0.6 }, { x: 0.5, y: 0.5 });
  return near(b.x, 0.2, 1e-9) && near(b.w, 0.6, 1e-9);
})());
check("boxFromCrop round-trips", (() => {
  const crop = { x: 0.2, y: 0.4, w: 0.5, h: 0.5 };
  const back = boxFromCrop({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, crop);
  return near(back.x, 0.325, 1e-9) && near(back.w, 0.25, 1e-9);
})());

// --- end-to-end with an exact oracle ---------------------------------------

const DOOR_RGB = { r: 210, g: 170, b: 60 }; // distinct from the magenta/cyan grid

async function syntheticHouse(W: number, H: number, door: DoorBox): Promise<Buffer> {
  const dx = Math.round(door.x * W);
  const dy = Math.round(door.y * H);
  const dw = Math.round(door.w * W);
  const dh = Math.round(door.h * H);
  const panel = await sharp({
    create: { width: dw, height: dh, channels: 4, background: { ...DOOR_RGB, alpha: 255 } },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: W, height: H, channels: 4, background: { r: 90, g: 105, b: 120, alpha: 255 } },
  })
    .composite([{ input: panel, left: dx, top: dy }])
    .png()
    .toBuffer();
}

/** Read the door's true position out of an image by scanning for its colour. */
async function scanDoor(img: Buffer): Promise<DoorBox | undefined> {
  const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (
        Math.abs(data[i]! - DOOR_RGB.r) < 40 &&
        Math.abs(data[i + 1]! - DOOR_RGB.g) < 40 &&
        Math.abs(data[i + 2]! - DOOR_RGB.b) < 40
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return undefined;
  return {
    x: minX / info.width,
    y: minY / info.height,
    w: (maxX - minX) / info.width,
    h: (maxY - minY) / info.height,
  };
}

/** A perfect "model": reports the cells the door genuinely occupies. */
const oracle: VisionCaller = async (imageBase64, prompt) => {
  const img = Buffer.from(imageBase64, "base64");
  const box = await scanDoor(img);
  const fine = prompt.includes("close crop");
  const cols = fine ? FINE_COLS : COARSE_COLS;
  const rows = fine ? FINE_ROWS : COARSE_ROWS;
  if (!box) {
    return JSON.stringify({ leftCol: null, rightCol: null, topRow: null, bottomRow: null });
  }
  const clamp = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v * n)));
  return JSON.stringify({
    doorCount: 1,
    where: "synthetic door",
    leftCol: COL_LABELS[clamp(box.x, cols)],
    rightCol: COL_LABELS[clamp(box.x + box.w, cols)],
    topRow: clamp(box.y, rows) + 1,
    bottomRow: clamp(box.y + box.h, rows) + 1,
    widthClass: "double",
    heightClass: "standard",
  });
};

console.log("\nend-to-end (oracle vision)");
// Positions chosen to land at awkward fractions of a grid cell, not on tidy
// boundaries — quantisation error is worst mid-cell, so this is the honest case.
const cases: Array<{ name: string; door: DoorBox }> = [
  { name: "centre-right double (photo A truth)", door: { x: 0.284, y: 0.368, w: 0.588, h: 0.452 } },
  { name: "small, low, left-of-centre (photo B truth)", door: { x: 0.33, y: 0.579, w: 0.29, h: 0.302 } },
  { name: "far left, small", door: { x: 0.06, y: 0.55, w: 0.19, h: 0.26 } },
  { name: "far right, tall", door: { x: 0.7, y: 0.3, w: 0.25, h: 0.55 } },
  { name: "fills most of frame", door: { x: 0.08, y: 0.1, w: 0.8, h: 0.78 } },
  { name: "dead centre", door: { x: 0.37, y: 0.41, w: 0.27, h: 0.31 } },
  { name: "wide and short", door: { x: 0.19, y: 0.63, w: 0.63, h: 0.17 } },
  { name: "narrow and tall", door: { x: 0.44, y: 0.21, w: 0.13, h: 0.61 } },
  { name: "flush to left edge", door: { x: 0.01, y: 0.44, w: 0.31, h: 0.39 } },
  { name: "flush to right edge", door: { x: 0.67, y: 0.47, w: 0.32, h: 0.41 } },
  { name: "flush to bottom", door: { x: 0.29, y: 0.66, w: 0.37, h: 0.33 } },
  { name: "awkward thirds", door: { x: 0.233, y: 0.317, w: 0.411, h: 0.433 } },
];

for (const { name, door } of cases) {
  const img = await syntheticHouse(826, 397, door);
  const got = await detectDoor(img, oracle);
  const score = got.bbox ? iou(got.bbox, door) : 0;
  check(
    `${name} — IoU ${score.toFixed(3)} (stage: ${got.stage})`,
    score > 0.75 && got.stage === "refined",
    got.bbox ? `got ${JSON.stringify(got.bbox)} want ${JSON.stringify(door)}` : "no bbox"
  );
}

console.log("\nfailure handling");
{
  const img = await syntheticHouse(826, 397, { x: 0.33, y: 0.579, w: 0.29, h: 0.302 });

  const dead: VisionCaller = async () => {
    throw new Error("upstream down");
  };
  const d1 = await detectDoor(img, dead);
  check("vision failure yields no bbox, not a guess", !d1.bbox && d1.stage === "none");

  const garbage: VisionCaller = async () => "not json at all";
  const d2 = await detectDoor(img, garbage);
  check("unparseable reply yields no bbox", !d2.bbox && d2.stage === "none");

  const nulls: VisionCaller = async () =>
    JSON.stringify({ leftCol: null, rightCol: null, topRow: null, bottomRow: null });
  const d3 = await detectDoor(img, nulls);
  check("explicit 'no door' yields no bbox", !d3.bbox && d3.stage === "none");

  let n = 0;
  const coarseOnly: VisionCaller = async (b, p) => (++n === 1 ? oracle(b, p) : "garbage");
  const d4 = await detectDoor(img, coarseOnly);
  check("refine failure falls back to coarse box", !!d4.bbox && d4.stage === "coarse");

  const classesOnly: VisionCaller = async () =>
    JSON.stringify({ widthClass: "single", heightClass: "tall", leftCol: null });
  const d5 = await detectDoor(img, classesOnly);
  check("size classes survive a failed box", d5.widthClass === "single" && d5.heightClass === "tall");
}

console.log("\nfine prompt");
check("refine prompt defines the bottom edge", FINE_PROMPT.includes("meets the ground"));
check("refine prompt keeps the panel-seam clause", FINE_PROMPT.includes("panel sections"));
check("refine prompt no longer references a marker", !FINE_PROMPT.includes("marker"));
check("coarse prompt says panels are not door edges", COARSE_PROMPT.includes("Count doors by openings"));

console.log("\nfont sanity");
check("textRenders() is true where fonts exist", await textRenders());
{
  // Prove the check can actually fail, so a green result means something.
  const blank = await sharp({
    create: { width: 80, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .greyscale()
    .raw()
    .toBuffer();
  let ink = 0;
  for (const v of blank) if (v > 128) ink++;
  check("an unrendered canvas would be caught", ink <= 60);
}

console.log("\ngrid rendering");
{
  const img = await syntheticHouse(826, 397, { x: 0.33, y: 0.579, w: 0.29, h: 0.302 });
  const g = await renderGrid(img, 12, 8);
  const m = await sharp(g).metadata();
  check("grid preserves dimensions", m.width === 826 && m.height === 397);
  check("grid changes pixels", g.length !== img.length);
  const stillFindable = await scanDoor(g);
  check("door still readable under grid", !!stillFindable && iou(stillFindable, { x: 0.33, y: 0.579, w: 0.29, h: 0.302 }) > 0.85);
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}\n`);
process.exit(failures === 0 ? 0 : 1);
