import sharp from "sharp";

const INPUT = "/home/user/workspace/webapp/public/og-base.png";
const OUTPUT = "/home/user/workspace/webapp/public/og-garage.png";

const W = 1200;
const H = 630;

const meta = await sharp(INPUT).metadata();
const srcW = meta.width!;
const srcH = meta.height!;
console.log(`Source: ${srcW}x${srcH}`);

// Crop out the baked-in text: top title (~24%) and bottom labels (~16%)
const cropTop = Math.round(srcH * 0.24);
const cropBottom = Math.round(srcH * 0.16);
const cropH = srcH - cropTop - cropBottom;

const baseImg = await sharp(INPUT)
  .extract({ left: 0, top: cropTop, width: srcW, height: cropH })
  .resize(W, H, { fit: "cover", position: "center" })
  .png()
  .toBuffer();

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="botGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.7"/>
    </linearGradient>
    <filter id="ts">
      <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <!-- Dark gradients for text readability -->
  <rect width="${W}" height="200" fill="url(#topGrad)"/>
  <rect y="${H - 160}" width="${W}" height="160" fill="url(#botGrad)"/>

  <!-- Center split divider -->
  <rect x="${W / 2 - 1}" y="0" width="2" height="${H}" fill="white" opacity="0.85"/>

  <!-- Main title -->
  <text
    x="${W / 2}" y="68"
    text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif"
    font-size="50" font-weight="900"
    fill="white"
    filter="url(#ts)">See Any Garage Door on Your Home</text>

  <!-- Subtitle -->
  <text
    x="${W / 2}" y="112"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="23" font-weight="bold"
    fill="#FFD700"
    filter="url(#ts)">Free AI Visualizer · Upload Your Photo · 941garagedoor.com</text>

  <!-- BEFORE badge -->
  <rect x="28" y="${H - 74}" width="165" height="50" rx="7" fill="#000000" fill-opacity="0.65"/>
  <text
    x="110" y="${H - 39}"
    text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif"
    font-size="26" font-weight="900"
    fill="white" letter-spacing="3">BEFORE</text>

  <!-- AFTER badge -->
  <rect x="${W - 193}" y="${H - 74}" width="165" height="50" rx="7" fill="#1a7f1a" fill-opacity="0.9"/>
  <text
    x="${W - 110}" y="${H - 39}"
    text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif"
    font-size="26" font-weight="900"
    fill="white" letter-spacing="3">AFTER</text>
</svg>`;

const svgPng = await sharp(Buffer.from(svg)).png().toBuffer();

const result = await sharp(baseImg)
  .composite([{ input: svgPng, top: 0, left: 0 }])
  .png()
  .toBuffer();

await Bun.write(OUTPUT, result);
console.log(`Generated: ${OUTPUT} (${(result.length / 1024).toFixed(0)} KB)`);
