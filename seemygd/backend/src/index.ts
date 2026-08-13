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
  // SeeMyGD production (apex + www + any subdomain, e.g. app.seemygd.com).
  /^https:\/\/([a-z0-9-]+\.)?seemygd\.com$/,
  // Lovable hosting: published site + editor previews.
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  // Tenant custom domains are allowed dynamically below.
  ...(process.env.EXTRA_TRUSTED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => new RegExp(`^${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)),
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

// NOTE: "/" is served by the SPA handler at the bottom of this file, which
// returns the built webapp/dist/index.html. That file already carries the full
// OG/Twitter/JSON-LD tag set, so crawlers get correct metadata without the
// hand-written duplicate that used to live here (it pointed at the old
// visualizer.941garagedoor.com URLs and loaded the dev-only /src/main.tsx).

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

// ---------------------------------------------------------------------------
// Static frontend
//
// On Vibecode the built webapp was served by the platform's static host and
// /api/* was proxied here. Off-platform we serve both from this one process, so
// the whole tool is a single deployable at a single origin — which also keeps
// the frontend's relative "/api/..." calls and same-origin auth cookies working
// exactly as they do today.
// ---------------------------------------------------------------------------
const WEBAPP_DIST = new URL("../../webapp/dist/", import.meta.url);

app.get("*", async (c) => {
  const pathname = new URL(c.req.url).pathname;

  // Never let the SPA fallback swallow an unmatched API route — that turns a
  // 404 into a 200 of HTML and makes client-side JSON parsing fail confusingly.
  if (pathname.startsWith("/api/")) {
    return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  }

  // Serve the real asset when one exists (hashed JS/CSS bundles, images,
  // embed.js, robots.txt, sitemap.xml, demo.mp4, …).
  if (pathname !== "/" && !pathname.includes("..")) {
    const asset = Bun.file(new URL(`.${pathname}`, WEBAPP_DIST));
    if (await asset.exists()) {
      const immutable = pathname.startsWith("/assets/");
      return new Response(await asset.arrayBuffer(), {
        headers: {
          "Content-Type": asset.type || "application/octet-stream",
          "Cache-Control": immutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        },
      });
    }
  }

  // Otherwise hand back index.html so client-side routes (/v/:slug, /dashboard,
  // /admin, /preview, /legal) resolve on a hard refresh or a direct link.
  const index = Bun.file(new URL("./index.html", WEBAPP_DIST));
  if (!(await index.exists())) {
    return c.text(
      "Frontend not built. Run `bun run build` in webapp/ (see MIGRATION.md).",
      503
    );
  }
  return c.html(await index.text(), 200, { "Cache-Control": "no-store" });
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // allow long-running AI image calls (seconds)
};
