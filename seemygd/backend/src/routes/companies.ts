import { Hono } from "hono"
import sharp from "sharp"
import { auth } from "../auth"
import { db } from "../prisma"
import { z } from "zod"
import { VanitySlugSchema, RESERVED_SLUGS } from "../types"
import { verifyPreview } from "../preview-token"
import { scrapeBrand } from "./onboard"
import { saveBrandingImage, contentTypeForExt } from "../storage"

const companies = new Hono()

// Title-case a bare hostname into a fallback business name when scraping can't
// find one, e.g. "smithgaragedoors.com" -> "Smithgaragedoors".
function hostToName(site: string): string {
  const base = site.replace(/^www\./, "").split(".")[0] ?? site
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || site
}

// Re-render an uploaded hero/background photo with AI so it looks crisp when
// stretched to fill the visualizer banner. The banner uses `background-size: cover`,
// so a low-res or oddly-shaped source ends up blurry/stretched. We send the photo
// to gpt-image-1 at a clean landscape banner ratio and ask it to sharpen the
// resolution & clarity while preserving the exact scene. Returns the enhanced
// PNG buffer, or null if AI is unavailable/fails (caller keeps the original).
async function enhanceHeroImage(input: Buffer): Promise<Buffer | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null
  const openaiBase = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"

  try {
    // Normalize to a PNG the edits endpoint accepts (also corrects EXIF rotation).
    const pngBuffer = await sharp(input).rotate().png().toBuffer()
    const pngBlob = new Blob([pngBuffer], { type: "image/png" })

    const prompt = [
      "Enhance this photo to look crisp and high-resolution when used as a wide website banner background.",
      "Sharpen fine details, remove blur, noise, and compression artifacts, and improve clarity, focus, and lighting.",
      "Keep the exact same scene, composition, framing, colors, and subjects — do not add, remove, or move any objects.",
      "The result should look like a clean, professional, high-definition version of the same photograph.",
    ].join(" ")

    const form = new FormData()
    form.append("image", pngBlob, "hero.png")
    form.append("prompt", prompt)
    form.append("model", "gpt-image-1")
    form.append("n", "1")
    form.append("size", "1536x1024")
    form.append("quality", "high")

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90_000)
    let resp: Response
    try {
      resp = await fetch(`${openaiBase}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!resp.ok) {
      console.error("[hero/enhance] OpenAI error", resp.status, (await resp.text().catch(() => "")).slice(0, 300))
      return null
    }

    const json = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> }
    const first = json.data?.[0]
    let b64 = first?.b64_json
    if (!b64 && first?.url) {
      const imgResp = await fetch(first.url)
      b64 = Buffer.from(await imgResp.arrayBuffer()).toString("base64")
    }
    if (!b64) return null

    // Re-encode to a web-friendly JPEG to keep the file small.
    return await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 88 }).toBuffer()
  } catch (err) {
    console.error("[hero/enhance] failed", err)
    return null
  }
}

// Normalize a hostname for comparison: lowercase, strip port and leading www.
function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
}

// Public: resolve a company by the custom domain it's being served on.
// The frontend passes its current hostname; if a company has claimed that
// domain we return its id so the visualizer can render at the domain root.
companies.get("/resolve-by-host", async (c) => {
  const host = c.req.query("host") ?? ""
  const normalized = normalizeHost(host)
  if (!normalized) return c.json({ data: null })

  // Match against stored customDomain (normalized the same way).
  const candidates = await db.company.findMany({
    where: { customDomain: { not: null } },
    select: { id: true, customDomain: true },
  })
  const match = candidates.find(
    (co) => co.customDomain && normalizeHost(co.customDomain) === normalized
  )
  return c.json({ data: match ? { id: match.id } : null })
})

// Public: admin-generated PREVIEW branding (no auth, no stored data).
// Validates the signed token in the query string, then scrapes the given site
// live and returns branding shaped exactly like the /:id/branding response so
// the visualizer can render it. Nothing is persisted; once the token's expiry
// passes this returns 410 and the preview is dead.
companies.get("/preview-branding", async (c) => {
  const site = c.req.query("site") ?? ""
  const expires = c.req.query("expires") ?? ""
  const sig = c.req.query("sig") ?? ""

  const verdict = verifyPreview(site, expires, sig)
  if (!verdict.ok) {
    if (verdict.reason === "expired") {
      return c.json({ error: { message: "This preview link has expired.", code: "PREVIEW_EXPIRED" } }, 410)
    }
    return c.json({ error: { message: "Invalid preview link.", code: "PREVIEW_INVALID" } }, 403)
  }

  const scraped = await scrapeBrand(`https://${verdict.site}`)
  const branding = {
    // No company record exists for a preview — empty id keeps lead capture
    // and other company-scoped calls from attaching to a real tenant.
    id: "",
    businessName: scraped.businessName || hostToName(verdict.site),
    logoUrl: scraped.logoUrl,
    heroImageUrl: scraped.heroImageUrl,
    primaryColorHex: scraped.primaryColorHex || "#2563EB",
    contactPhone: scraped.contactPhone,
    contactEmail: scraped.contactEmail,
    websiteUrl: `https://${verdict.site}`,
    // Previews always render as if live so the subscription gate is satisfied.
    subscriptionStatus: "active",
    tierType: "growth",
    isPreview: true as const,
  }
  // Previews are ephemeral; don't let intermediaries cache them.
  c.header("Cache-Control", "no-store")
  return c.json({ data: branding })
})

// Public branding endpoint (no auth).
// The :id param may be either the company's cuid OR its vanity slug
// (e.g. /v/acme-doors), so the visualizer can render from a clean URL.
companies.get("/:id/branding", async (c) => {
  const idOrSlug = c.req.param("id")
  const company = await db.company.findFirst({
    where: { OR: [{ id: idOrSlug }, { vanitySlug: idOrSlug }] },
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      heroImageUrl: true,
      primaryColorHex: true,
      contactPhone: true,
      contactEmail: true,
      websiteUrl: true,
      vanitySlug: true,
      subscriptionStatus: true,
      tierType: true,
    },
  })
  if (!company) {
    return c.json({ error: { message: "Company not found", code: "NOT_FOUND" } }, 404)
  }
  // Don't cache too long — subscription status can change
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60")
  return c.json({ data: company })
})

async function requireSession(c: { req: { raw: Request } }) {
  return auth.api.getSession({ headers: c.req.raw.headers })
}

companies.get("/me", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }
  return c.json({ data: user.company })
})

// GET /api/companies/me/subscription — return subscription info for current company
companies.get("/me/subscription", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }

  return c.json({
    data: {
      subscriptionStatus: user.company.subscriptionStatus,
      tierType: user.company.tierType,
      squareSubscriptionId: user.company.squareSubscriptionId,
    },
  })
})

// Check whether a vanity slug is available for the current company.
// GET /api/companies/slug-available?slug=acme-doors
companies.get("/slug-available", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  const raw = c.req.query("slug") ?? ""
  const parsed = VanitySlugSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ data: { available: false, reason: parsed.error.issues[0]?.message ?? "Invalid slug" } })
  }
  const slug = parsed.data
  if (RESERVED_SLUGS.has(slug)) {
    return c.json({ data: { available: false, reason: "This slug is reserved" } })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const existing = await db.company.findUnique({ where: { vanitySlug: slug }, select: { id: true } })
  const available = !existing || existing.id === user?.companyId
  return c.json({ data: { available, reason: available ? null : "This slug is already taken" } })
})

const updateCompanySchema = z.object({
  businessName: z.string().optional(),
  logoUrl: z.string().optional(),
  heroImageUrl: z.string().optional(),
  primaryColorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  // Lead-notification email — independent of the public contact email. Blank by
  // default; when set, lead alerts go here instead of the contact email.
  notificationEmail: z.string().email().optional().or(z.literal("")),
  resendApiKey: z.string().optional(),
  resendFromEmail: z.string().email().optional().or(z.literal("")),
  // Empty string clears the slug; otherwise it must pass slug validation.
  vanitySlug: z.union([z.literal(""), VanitySlugSchema]).optional(),
  // Custom domain is Growth-only (enforced below). Empty string clears it.
  customDomain: z.string().trim().optional(),
})

companies.put("/me", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  // Be forgiving about the website field: owners routinely type a bare domain
  // ("941garagedoor.com") which fails strict URL validation. Prepend https://
  // so the save succeeds instead of showing a cryptic "Invalid URL" error.
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>
    if (typeof b.websiteUrl === "string" && b.websiteUrl.trim() !== "" && !/^https?:\/\//i.test(b.websiteUrl.trim())) {
      b.websiteUrl = `https://${b.websiteUrl.trim()}`
    }
  }

  const parsed = updateCompanySchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    )
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, include: { company: true } })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }
  const company = user.company
  const data = { ...parsed.data }

  // Vanity slug: reject reserved words; normalize empty string to null (clears it).
  if (data.vanitySlug !== undefined) {
    if (data.vanitySlug === "") {
      data.vanitySlug = null as unknown as string
    } else if (RESERVED_SLUGS.has(data.vanitySlug)) {
      return c.json({ error: { message: "This slug is reserved", code: "SLUG_RESERVED" } }, 400)
    }
  }

  // Custom domain is a Growth-tier feature. Block non-Growth accounts from
  // setting one; allow clearing it (empty string) regardless.
  if (data.customDomain !== undefined) {
    if (data.customDomain === "") {
      data.customDomain = null as unknown as string
    } else if (company.tierType !== "growth") {
      return c.json(
        { error: { message: "Custom domains require the Growth plan", code: "GROWTH_REQUIRED" } },
        403
      )
    }
  }

  try {
    const updated = await db.company.update({ where: { id: company.id }, data })
    return c.json({ data: updated })
  } catch (err: unknown) {
    // Prisma unique-constraint violation (slug or domain already taken).
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      const target = String((err as { meta?: { target?: unknown } }).meta?.target ?? "")
      const field = target.includes("vanitySlug")
        ? "That URL slug is already taken"
        : target.includes("customDomain")
          ? "That custom domain is already in use"
          : "That value is already in use"
      return c.json({ error: { message: field, code: "CONFLICT" } }, 409)
    }
    throw err
  }
})

companies.post("/me/upload-image", async (c) => {
  const session = await requireSession(c)
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.companyId) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: { message: "Invalid multipart form data", code: "BAD_REQUEST" } }, 400)
  }

  const type = formData.get("type")
  if (type !== "logo" && type !== "hero") {
    return c.json({ error: { message: "Field 'type' must be 'logo' or 'hero'", code: "BAD_REQUEST" } }, 400)
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return c.json({ error: { message: "Field 'file' is required", code: "BAD_REQUEST" } }, 400)
  }

  if (!file.type.startsWith("image/")) {
    return c.json({ error: { message: "File must be an image", code: "BAD_REQUEST" } }, 400)
  }

  let ext = file.name.includes(".") ? file.name.split(".").pop()! : "bin"
  let bytes: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer())

  // For background/hero photos, run an AI cleanup pass: the visualizer stretches
  // the image to fill its banner (cover), which makes low-res/odd-shaped photos
  // look blurry & distorted. We re-render it crisp at a clean banner ratio.
  if (type === "hero") {
    const enhanced = await enhanceHeroImage(bytes)
    if (enhanced) {
      bytes = enhanced
      ext = "jpg"
    }
  }

  const filename = `${user.companyId}-${type}-${Date.now()}.${ext}`
  const urlPath = await saveBrandingImage(filename, bytes, contentTypeForExt(ext))

  const updateField = type === "logo" ? { logoUrl: urlPath } : { heroImageUrl: urlPath }
  await db.company.update({ where: { id: user.companyId }, data: updateField })

  return c.json({ data: { url: urlPath } })
})

export default companies
