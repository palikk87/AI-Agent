/**
 * Measure door detection against real photos and a real model.
 *
 * The offline suite (test-door-detect.ts) proves the coordinate pipeline is
 * correct given a model that reads the grid properly. This one measures whether
 * the model actually does. It is the check that was missing when the previous
 * two attempts shipped.
 *
 *   OPENAI_API_KEY=sk-... bun run scripts/measure-door-detect.ts fixtures.json [outDir]
 *
 * fixtures.json is a list of photos, each with the true door box as fractions
 * of the image. Omit `truth` to just see what comes back.
 *
 *   [
 *     { "image": "photos/a.png", "truth": { "x": 0.284, "y": 0.368, "w": 0.588, "h": 0.452 } },
 *     { "image": "photos/b.webp" }
 *   ]
 *
 * Writes an annotated PNG per photo (detected box, plus truth when known) so
 * the numbers can be eyeballed rather than trusted.
 */
import sharp from "sharp";
import { type DoorBox, detectDoor, openaiVision } from "../src/door-detect";

const [fixturesPath, outDir = "detect-out"] = process.argv.slice(2);
if (!fixturesPath) {
  console.error("usage: bun run scripts/measure-door-detect.ts <fixtures.json> [outDir]");
  process.exit(2);
}

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY is not set — this script needs a real model to be worth running.");
  process.exit(2);
}
const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

function iou(a: DoorBox, b: DoorBox) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  return inter / (a.w * a.h + b.w * b.h - inter);
}

async function annotate(img: string, out: string, boxes: Array<{ label: string; color: string; box: DoorBox }>) {
  const meta = await sharp(img).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const svg = boxes
    .map(({ label, color, box }) => {
      const x = box.x * W;
      const y = box.y * H;
      return (
        `<rect x="${x}" y="${y}" width="${box.w * W}" height="${box.h * H}" fill="none" stroke="${color}" stroke-width="4"/>` +
        `<rect x="${x}" y="${Math.max(0, y - 26)}" width="${label.length * 11 + 12}" height="24" fill="${color}"/>` +
        `<text x="${x + 6}" y="${Math.max(18, y - 8)}" font-family="sans-serif" font-size="18" fill="#000">${label}</text>`
      );
    })
    .join("");
  await sharp(img)
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${svg}</svg>`), top: 0, left: 0 }])
    .png()
    .toFile(out);
}

type Fixture = { image: string; truth?: DoorBox };
const fixtures: Fixture[] = JSON.parse(await Bun.file(fixturesPath).text());
await Bun.write(`${outDir}/.keep`, "");

const vision = openaiVision(base, key);
const scores: number[] = [];
let missing = 0;

for (const { image, truth } of fixtures) {
  const buf = Buffer.from(await Bun.file(image).arrayBuffer());
  const started = Date.now();
  const got = await detectDoor(buf, vision);
  const ms = Date.now() - started;

  const name = image.split("/").pop()!;
  if (!got.bbox) {
    missing++;
    console.log(`${name}: NO BOX (stage=${got.stage}, ${ms}ms)`);
    continue;
  }

  const boxes = [{ label: "detected", color: "#ff0000", box: got.bbox }];
  let line = `${name}: ${got.stage} ${JSON.stringify(got.bbox)} ${got.widthClass}/${got.heightClass} ${ms}ms`;
  if (truth) {
    const score = iou(got.bbox, truth);
    scores.push(score);
    boxes.push({ label: "truth", color: "#ffff00", box: truth });
    line += `  IoU ${score.toFixed(3)}${score < 0.6 ? "  <-- BAD" : ""}`;
  }
  console.log(line);
  await annotate(image, `${outDir}/${name.replace(/\.\w+$/, "")}-detected.png`, boxes);
}

if (scores.length) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const worst = Math.min(...scores);
  const bad = scores.filter((s) => s < 0.6).length;
  console.log(
    `\nmean IoU ${mean.toFixed(3)}  worst ${worst.toFixed(3)}  under-0.6 ${bad}/${scores.length}  no-box ${missing}`
  );
  console.log(`overlays in ${outDir}/`);
}
