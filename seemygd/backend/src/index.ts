import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { garageRouter } from "./routes/garage";
import { leadsRouter } from "./routes/leads";
import { logger } from "hono/logger";
import { auth } from "./auth";
import companies from "./routes/companies";
import onboard from "./routes/onboard";
import { squareRouter } from "./routes/square";
import { adminRouter } from "./routes/admin";
import { repairRouter } from "./routes/repair";
import { clearCopiedResendCredentials } from "./startup-cleanup";

const app = new Hono();

// One-time maintenance on boot: ensure Resend credentials are blank on all
// non-super-admin accounts until each owner enters their own (idempotent).
void clearCopiedResendCredentials();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// /api/link — bypass CDN cache: Facebook scrapes this, browsers redirect to homepage
// Share https://visualizer.941garagedoor.com/api/link on Facebook
app.get("/api/link", (c) => {
  const ua = c.req.header("user-agent") ?? "";
  const isCrawler = /facebookexternalhit|Facebot|twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|bot|crawler|spider/i.test(ua);
  if (!isCrawler) {
    return c.redirect("https://visualizer.941garagedoor.com", 302);
  }
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>See Any Garage Door on Your Own Home — Free AI Visualizer</title>
  <meta property="og:title" content="See Any Garage Door on Your Own Home"/>
  <meta property="og:description" content="Upload a photo and our free AI tool shows you exactly how a new garage door would look on your house. Try it now — it only takes seconds."/>
  <meta property="og:type" content="video.other"/>
  <meta property="og:url" content="https://visualizer.941garagedoor.com"/>
  <meta property="og:image" content="https://visualizer.941garagedoor.com/api/og-image"/>
  <meta property="og:image:width" content="1150"/>
  <meta property="og:image:height" content="928"/>
  <meta property="og:video" content="https://visualizer.941garagedoor.com/demo.mp4"/>
  <meta property="og:video:secure_url" content="https://visualizer.941garagedoor.com/demo.mp4"/>
  <meta property="og:video:type" content="video/mp4"/>
  <meta property="og:video:width" content="1200"/>
  <meta property="og:video:height" content="630"/>
</head>
<body></body>
</html>`;
  return c.html(html, 200, { "Cache-Control": "no-store" });
});

// Root: serve fresh HTML with OG tags so CDN cache doesn't block crawlers
app.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>See Any Garage Door on Your Own Home — Free AI Visualizer</title>
  <meta name="description" content="Upload a photo of your home and instantly see how different garage doors look on it. Free AI tool — no account needed, results in seconds."/>
  <meta property="og:title" content="See Any Garage Door on Your Own Home"/>
  <meta property="og:description" content="Upload a photo and our free AI tool shows you exactly how a new garage door would look on your house. Try it now — it only takes seconds."/>
  <meta property="og:type" content="video.other"/>
  <meta property="og:url" content="https://visualizer.941garagedoor.com"/>
  <meta property="og:image" content="https://visualizer.941garagedoor.com/og-garage.png"/>
  <meta property="og:image:width" content="1150"/>
  <meta property="og:image:height" content="928"/>
  <meta property="og:video" content="https://visualizer.941garagedoor.com/demo.mp4"/>
  <meta property="og:video:secure_url" content="https://visualizer.941garagedoor.com/demo.mp4"/>
  <meta property="og:video:type" content="video/mp4"/>
  <meta property="og:video:width" content="1200"/>
  <meta property="og:video:height" content="630"/>
  <meta name="twitter:card" content="player"/>
  <meta name="twitter:title" content="See Any Garage Door on Your Own Home"/>
  <meta name="twitter:description" content="Upload a photo and our free AI shows you a new door on your house in seconds. Free tool — try it now."/>
  <meta name="twitter:image" content="https://visualizer.941garagedoor.com/og-garage.png"/>
  <meta name="twitter:player" content="https://visualizer.941garagedoor.com/preview.html"/>
  <meta name="twitter:player:width" content="1280"/>
  <meta name="twitter:player:height" content="720"/>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  return c.html(html, 200, { "Cache-Control": "no-store" });
});

// Serve OG preview image directly (bypasses CDN static file cache)
app.get("/api/og-image", async (c) => {
  const file = Bun.file(new URL("../../webapp/public/og-garage.png", import.meta.url));
  const exists = await file.exists();
  if (!exists) return c.notFound();
  const buf = await file.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

// Serve uploaded files statically
app.get("/uploads/:filename", async (c) => {
  const filename = c.req.param("filename");
  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return c.json({ error: "Not found" }, 404);
  }
  const uploadsDir = process.cwd() + "/uploads/";
  const file = Bun.file(`${uploadsDir}${filename}`);
  const exists = await file.exists();
  if (!exists) return c.json({ error: "Not found" }, 404);
  const buf = await file.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000",
    },
  });
});

// Better Auth handler (handles all /api/auth/* routes)
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/garage", garageRouter);
app.route("/api/leads", leadsRouter);
app.route("/api/companies", companies);
app.route("/api/onboard", onboard);
app.route("/api/square", squareRouter);
app.route("/api/admin", adminRouter);
app.route("/api/repair", repairRouter);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // allow long-running AI image calls (seconds)
};
