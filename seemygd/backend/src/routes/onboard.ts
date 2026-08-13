import { Hono } from "hono"
import { auth } from "../auth"
import { db } from "../prisma"
import { z } from "zod"

const onboard = new Hono()

async function requireSession(c: { req: { raw: Request } }) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return session
}

// Accept anything and normalize below (owners rarely type "https://").
const scrapeBrandSchema = z.object({ websiteUrl: z.string().min(1) })

// ── Brand-scraping helpers ───────────────────────────────────────────────────

// Turn "foo.com", "www.foo.com", "http://foo.com" into a valid https URL.
export function normalizeWebsiteUrl(raw: string): string | null {
  let v = raw.trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    if (!u.hostname.includes(".")) return null
    return u.toString()
  } catch {
    return null
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&quot;/gi, '"')
}

function absolutize(url: string | null, base: string): string | null {
  if (!url) return null
  const cleaned = decodeEntities(url.trim().replace(/^["']|["']$/g, ""))
  if (!cleaned || cleaned.startsWith("data:")) return null
  try {
    return new URL(cleaned, base).toString()
  } catch {
    return null
  }
}

// Pull an attribute (e.g. content, href, src) out of a single tag string.
function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))
  return m?.[1] ?? null
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`
}

// Reject near-white / near-black / low-saturation grays — brand colors have punch.
function isVividColor(hex: string): boolean {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m?.[1]) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max > 240 && min > 240) return false // near white
  if (max < 30) return false // near black
  if (max - min < 24) return false // gray-ish
  return true
}

// Collect every color declaration in a CSS/HTML blob and tally the vivid ones.
function tallyColors(blob: string, counts: Map<string, number>) {
  const hexRe = /#([0-9a-fA-F]{6})\b/g
  let m: RegExpExecArray | null
  while ((m = hexRe.exec(blob))) {
    const hex = `#${(m[1] ?? "").toLowerCase()}`
    if (isVividColor(hex)) counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  const rgbRe = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g
  while ((m = rgbRe.exec(blob))) {
    const hex = rgbToHex(+(m[1] ?? 0), +(m[2] ?? 0), +(m[3] ?? 0))
    if (isVividColor(hex)) counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
}

async function fetchText(url: string, timeoutMs: number, maxBytes = 2_500_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DoorVizBrandBot/1.0)" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new TextDecoder().decode(buf.slice(0, maxBytes))
  } catch {
    return null
  }
}

export type ScrapeResult = {
  businessName: string | null
  logoUrl: string | null
  primaryColorHex: string | null
  contactPhone: string | null
  contactEmail: string | null
  heroImageUrl: string | null
}

export async function scrapeBrand(websiteUrl: string): Promise<ScrapeResult> {
  const empty: ScrapeResult = {
    businessName: null, logoUrl: null, primaryColorHex: null, contactPhone: null, contactEmail: null, heroImageUrl: null,
  }
  const html = await fetchText(websiteUrl, 10000)
  if (!html) return empty

  const metas = html.match(/<meta[^>]+>/gi) ?? []
  const links = html.match(/<link[^>]+>/gi) ?? []
  const imgs = html.match(/<img[^>]+>/gi) ?? []

  const metaContent = (prop: string): string | null => {
    const tag = metas.find(
      (t) =>
        new RegExp(`(?:property|name)\\s*=\\s*["']${prop}["']`, "i").test(t)
    )
    return tag ? attr(tag, "content") : null
  }

  // ── Business name ────────────────────────────────────────────────────────
  // Best-effort display name: JSON-LD "name" → og:site_name → <title> (with
  // common suffixes like " | Home" / " - Garage Doors" trimmed off).
  let businessName: string | null = null
  const jsonLdName = html.match(/"name"\s*:\s*"([^"]{2,80})"/i)
  if (jsonLdName?.[1]) businessName = decodeEntities(jsonLdName[1]).trim()
  if (!businessName) businessName = metaContent("og:site_name")
  if (!businessName) {
    const titleMatch = html.match(/<title[^>]*>([^<]{2,120})<\/title>/i)
    if (titleMatch?.[1]) {
      businessName = decodeEntities(titleMatch[1])
        .split(/\s*[|–—\-·:]\s*/)[0]
        ?.trim() || null
    }
  }
  if (businessName) businessName = businessName.replace(/\s+/g, " ").slice(0, 80).trim() || null

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoUrl: string | null = null
  // 1. JSON-LD "logo"
  const jsonLdLogo = html.match(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*"url"\s*:\s*"([^"]+)")/i)
  if (jsonLdLogo) logoUrl = jsonLdLogo[1] || jsonLdLogo[2] || null
  // 2. <img> whose src/class/id/alt mentions "logo"
  if (!logoUrl) {
    const logoImg = imgs.find((t) => /logo/i.test(t))
    if (logoImg) logoUrl = attr(logoImg, "src") || attr(logoImg, "data-src") || attr(logoImg, "data-lazy-src")
  }
  // 3. apple-touch-icon (usually a crisp square brand mark)
  if (!logoUrl) {
    const appleIcon = links.find((t) => /rel\s*=\s*["'][^"']*apple-touch-icon/i.test(t))
    if (appleIcon) logoUrl = attr(appleIcon, "href")
  }
  // 4. favicon / icon
  if (!logoUrl) {
    const icon = links.find((t) => /rel\s*=\s*["'][^"']*(?:shortcut )?icon/i.test(t))
    if (icon) logoUrl = attr(icon, "href")
  }
  logoUrl = absolutize(logoUrl, websiteUrl)

  // ── Hero / OG image ─────────────────────────────────────────────────────────
  let heroImageUrl: string | null =
    metaContent("og:image") || metaContent("og:image:url") || metaContent("twitter:image")
  if (!heroImageUrl) {
    const heroImg = imgs.find((t) => /(?:hero|banner|jumbotron|masthead|header-bg)/i.test(t))
    if (heroImg) heroImageUrl = attr(heroImg, "src") || attr(heroImg, "data-src")
  }
  heroImageUrl = absolutize(heroImageUrl, websiteUrl)

  // ── Primary color ───────────────────────────────────────────────────────────
  let primaryColorHex: string | null = null
  const themeColor = metaContent("theme-color")
  if (themeColor && /^#[0-9a-f]{6}$/i.test(themeColor.trim()) && isVividColor(themeColor.trim())) {
    primaryColorHex = themeColor.trim().toLowerCase()
  }
  if (!primaryColorHex) {
    // Prefer explicit brand/primary CSS variables when present.
    const varMatch = html.match(
      /--(?:color-)?(?:primary|brand|accent|main|theme)[a-z-]*\s*:\s*(#[0-9a-fA-F]{6}|rgba?\([^)]+\))/i
    )
    if (varMatch?.[1]) {
      const val = varMatch[1]
      const rgb = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
      const hex = rgb ? rgbToHex(+(rgb[1] ?? 0), +(rgb[2] ?? 0), +(rgb[3] ?? 0)) : val.toLowerCase()
      if (isVividColor(hex)) primaryColorHex = hex
    }
  }
  if (!primaryColorHex) {
    // Fall back to the most-used vivid color across inline styles, <style> blocks
    // and the first few linked stylesheets.
    const counts = new Map<string, number>()
    tallyColors(html, counts)
    const cssHrefs = links
      .filter((t) => /rel\s*=\s*["']stylesheet/i.test(t))
      .map((t) => absolutize(attr(t, "href"), websiteUrl))
      .filter((u): u is string => !!u)
      .slice(0, 3)
    const sheets = await Promise.all(cssHrefs.map((u) => fetchText(u, 6000, 800_000)))
    for (const css of sheets) if (css) tallyColors(css, counts)
    let best: string | null = null
    let bestN = 0
    for (const [hex, n] of counts) {
      if (n > bestN) { best = hex; bestN = n }
    }
    if (best) primaryColorHex = best
  }

  // ── Phone / email ───────────────────────────────────────────────────────────
  let contactPhone: string | null = null
  const telMatch = html.match(/href\s*=\s*["']tel:([^"']+)["']/i)
  if (telMatch?.[1]) {
    contactPhone = telMatch[1].replace(/[^\d+()\s.-]/g, "").trim()
  } else {
    const phoneMatch = html.match(/(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/)
    if (phoneMatch?.[1]) contactPhone = phoneMatch[1].trim()
  }

  let contactEmail: string | null = null
  const mailMatch =
    html.match(/href\s*=\s*["']mailto:([^"'?]+)["']/i) ||
    html.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/)
  if (mailMatch?.[1] && !/\.(png|jpe?g|gif|svg|webp)$/i.test(mailMatch[1])) {
    contactEmail = mailMatch[1].trim()
  }

  return { businessName, logoUrl, primaryColorHex, contactPhone, contactEmail, heroImageUrl }
}

onboard.post("/scrape-brand", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  const parsed = scrapeBrandSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    )
  }

  const normalized = normalizeWebsiteUrl(parsed.data.websiteUrl)
  if (!normalized) {
    return c.json({ error: { message: "That doesn't look like a valid website address.", code: "VALIDATION_ERROR" } }, 400)
  }

  const result = await scrapeBrand(normalized)
  return c.json({ data: result })
})

const completeOnboardSchema = z.object({
  businessName: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().optional(),
  heroImageUrl: z.string().optional(),
  primaryColorHex: z.string().optional().default("#2563EB"),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
})

onboard.post("/complete", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  const parsed = completeOnboardSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    )
  }

  const userId = session.user.id
  const data = parsed.data

  // Return existing company if user already has one
  const existingUser = await db.user.findUnique({
    where: { id: userId },
    include: { company: true },
  })
  if (existingUser?.company) {
    return c.json({ data: existingUser.company })
  }

  const company = await db.company.create({
    data: {
      businessName: data.businessName,
      websiteUrl: data.websiteUrl ?? null,
      logoUrl: data.logoUrl ?? null,
      heroImageUrl: data.heroImageUrl ?? null,
      primaryColorHex: data.primaryColorHex || "#2563EB",
      contactPhone: data.contactPhone ?? null,
      contactEmail: data.contactEmail ?? null,
      // Paid plans are dormant for now: every new signup gets the free comp
      // plan (Growth-level access) and is activated immediately, so the tool
      // is live the moment onboarding finishes — no payment required.
      tierType: "free",
      subscriptionStatus: "active",
      // New clients get the embed code only — no individualized /v/ URL.
      individualUrlEnabled: false,
      users: { connect: { id: userId } },
    },
  })

  return c.json({ data: company })
})

export default onboard
