import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { bearer } from "better-auth/plugins"
import { db } from "./prisma"

// Always-trusted origins (our own platform + local dev).
const STATIC_TRUSTED_ORIGINS = [
  "http://localhost:*",
  "http://127.0.0.1:*",
  "http://localhost:8000",
  // SeeMyGD production.
  "https://seemygd.com",
  "https://www.seemygd.com",
  // The app itself now lives on a subdomain, and the CORS allowlist in
  // index.ts already trusts any *.seemygd.com. Match it here, or owner sign-in
  // on the app host is rejected as an untrusted origin.
  "https://*.seemygd.com",
  // Lovable hosting: published app + editor previews.
  "https://*.lovable.app",
  "https://*.lovableproject.com",
  // Known production custom domains for 941 Garage Door.
  "https://941garagedoor.com",
  "https://www.941garagedoor.com",
  "https://visualizer.941garagedoor.com",
  // Extra origins for whatever host the API ends up on, comma-separated.
  ...(process.env.EXTRA_TRUSTED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]

// Strip protocol / path / port so "https://941garagedoor.com/" → "941garagedoor.com".
function bareHost(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase()
}

// Build https origins (apex + www) for a stored custom domain.
function customDomainOrigins(domain: string): string[] {
  const host = bareHost(domain)
  if (!host) return []
  const withoutWww = host.replace(/^www\./, "")
  return [`https://${withoutWww}`, `https://www.${withoutWww}`]
}

// Every company custom domain is a trusted origin for auth — otherwise Better
// Auth's CSRF/origin check rejects logins made from a customer's own domain
// (e.g. 941garagedoor.com) and the browser surfaces it as a cryptic error.
async function resolveTrustedOrigins(): Promise<string[]> {
  try {
    const companies = await db.company.findMany({
      where: { customDomain: { not: null } },
      select: { customDomain: true },
    })
    const domainOrigins = companies.flatMap((c) =>
      c.customDomain ? customDomainOrigins(c.customDomain) : []
    )
    return [...STATIC_TRUSTED_ORIGINS, ...domainOrigins]
  } catch {
    return STATIC_TRUSTED_ORIGINS
  }
}

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: process.env.BACKEND_URL || "http://localhost:3000",
  trustedOrigins: () => resolveTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [bearer()],
})
