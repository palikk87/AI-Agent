import { createHmac, timingSafeEqual } from "node:crypto"

// Admin-only URL Preview generator.
//
// A preview link lets a salesperson show a prospect what their branded
// visualizer would look like, WITHOUT creating a client/company record. The
// whole preview is self-contained in the URL: the site to brand from, an
// absolute expiry timestamp, and an HMAC signature so the expiry can't be
// tampered with. Nothing is stored server-side, so once the link expires there
// is nothing left behind.

const SECRET =
  process.env.PREVIEW_SIGNING_SECRET ||
  process.env.ADMIN_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  "doorviz-preview-dev-secret"

// How long a freshly generated preview link stays valid.
export const PREVIEW_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

// Normalize a site the admin typed into a bare hostname:
// "https://www.Smith.com/x" -> "smith.com". Returns null if unusable.
export function normalizePreviewSite(raw: string): string | null {
  let v = (raw || "").trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    const host = u.hostname.toLowerCase().replace(/^www\./, "")
    if (!host.includes(".")) return null
    return host
  } catch {
    return null
  }
}

// HMAC over the exact (site, expires) pair. Both are part of the signed
// payload so neither can be swapped without invalidating the signature.
export function signPreview(site: string, expires: number): string {
  return createHmac("sha256", SECRET).update(`${site}:${expires}`).digest("hex")
}

// Generate a fresh token that expires PREVIEW_TTL_MS from now.
export function createPreviewToken(site: string): { site: string; expires: number; sig: string } {
  const expires = Date.now() + PREVIEW_TTL_MS
  return { site, expires, sig: signPreview(site, expires) }
}

export type PreviewVerification =
  | { ok: true; site: string }
  | { ok: false; reason: "invalid" | "expired" }

// Validate a preview token: signature must match and it must not be expired.
export function verifyPreview(site: string, expiresRaw: string, sig: string): PreviewVerification {
  const expires = Number(expiresRaw)
  if (!site || !sig || !Number.isFinite(expires)) return { ok: false, reason: "invalid" }

  const expected = signPreview(site, expires)
  // Constant-time compare; guard against length mismatch (timingSafeEqual throws).
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" }

  if (Date.now() > expires) return { ok: false, reason: "expired" }
  return { ok: true, site }
}
