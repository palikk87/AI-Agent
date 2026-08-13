/**
 * Business-owner portal helpers.
 *
 * Homeowners use the embedded visualizer on a company's own site and never log
 * in. Business owners manage their account from ONE canonical portal domain —
 * always first-party, never inside a customer's site or an iframe. That avoids
 * Safari's third-party cookie/storage restrictions that make login-on-a-custom-
 * domain unreliable.
 *
 * PORTAL_ORIGIN resolution order:
 *   1. VITE_PORTAL_URL   — set this to a real domain (e.g. https://app.yoursaas.com)
 *   2. VITE_BASE_URL     — the platform's current base URL (default)
 */
function normalizeOrigin(value: string | undefined): string {
  if (!value) return ""
  return value.trim().replace(/\/+$/, "")
}

export const PORTAL_ORIGIN =
  normalizeOrigin(import.meta.env.VITE_PORTAL_URL) ||
  normalizeOrigin(import.meta.env.VITE_BASE_URL)

/** Owner-facing routes that must run on the portal, never on a custom domain. */
export const OWNER_ROUTES = ["/login", "/signup", "/dashboard", "/admin"]

/** The canonical login URL business owners should bookmark/share. */
export const PORTAL_LOGIN_URL = PORTAL_ORIGIN ? `${PORTAL_ORIGIN}/login` : "/login"

/**
 * Are we currently on a customer's custom domain (as opposed to the portal
 * itself, a platform preview host, or localhost)? If so, owner routes should
 * bounce to the portal.
 */
export function isCustomDomain(): boolean {
  if (typeof window === "undefined") return false
  if (!PORTAL_ORIGIN) return false

  const currentOrigin = window.location.origin
  if (currentOrigin === PORTAL_ORIGIN) return false

  const host = window.location.hostname
  const isLocal = host === "localhost" || host === "127.0.0.1"
  // Hosting/preview domains are not customer custom domains.
  const isPlatformHost = /\.(lovable\.app|lovableproject\.com|onrender\.com|up\.railway\.app|fly\.dev|vercel\.app)$/.test(host)
  if (isLocal || isPlatformHost) return false

  return true
}

/** Full portal URL for the current owner route (preserving path + query). */
export function portalUrlForCurrentRoute(): string {
  const { pathname, search } = window.location
  return `${PORTAL_ORIGIN}${pathname}${search}`
}
