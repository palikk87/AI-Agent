/**
 * Import a Vibecode studio JSON export into Supabase Postgres.
 *
 *   bun scripts/import-json-export.ts /path/to/seemygd-production-export.json
 *
 * The Vibecode production database is not reachable as a file — the deployment's
 * studio exposes REST only (`/api/tables/*`), so there is no `production.db` to
 * copy. This is the JSON-shaped sibling of migrate-sqlite-to-postgres.ts.
 *
 * Expected shape — either of these works:
 *   { "Company": [...], "User": [...], ... }
 *   { "tables": { "Company": [...], ... } }
 *   { "Company": { "rows": [...] }, ... }
 *
 * Password hashes and session tokens are copied verbatim, so existing logins and
 * active sessions survive. Every write is an upsert keyed on the original id, so
 * a partial run can simply be repeated.
 *
 * Run the schema first (`bunx prisma migrate deploy`), then this.
 */

import { PrismaClient } from "@prisma/client"

const path = process.argv[2]
if (!path) {
  console.error("Usage: bun scripts/import-json-export.ts <export.json>")
  process.exit(1)
}

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("DATABASE_URL must point at Postgres (Supabase) before running this.")
  process.exit(1)
}

const prisma = new PrismaClient()
const raw = JSON.parse(await Bun.file(path).text())

/** Pull a table's rows out of whichever envelope the export used. */
function rows(table: string): Record<string, unknown>[] {
  const source = raw?.tables ?? raw
  const found = source?.[table]
  if (!found) return []
  if (Array.isArray(found)) return found
  if (Array.isArray(found.rows)) return found.rows
  if (Array.isArray(found.data)) return found.data
  return []
}

/**
 * Dates arrive as ISO strings from JSON, but a studio export may also hand back
 * the raw SQLite epoch-milliseconds integer. Accept both.
 */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
    const asNumber = Number(value)
    if (!Number.isNaN(asNumber)) return new Date(asNumber)
  }
  return null
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1" || value === "true"
}

function toNum(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

function str(value: unknown): string | null {
  return value === undefined || value === "" ? null : (value as string | null)
}

async function copy(
  label: string,
  upsert: (row: Record<string, unknown>) => Promise<unknown>
) {
  const all = rows(label)
  let ok = 0
  let failed = 0
  for (const row of all) {
    try {
      await upsert(row)
      ok++
    } catch (err) {
      failed++
      console.error(`  ✗ ${label} id=${String(row.id)}: ${(err as Error).message}`)
    }
  }
  console.log(`${label.padEnd(16)} ${ok}/${all.length} copied${failed ? ` (${failed} FAILED)` : ""}`)
  return { ok, total: all.length, failed }
}

const results: Record<string, { ok: number; total: number; failed: number }> = {}

// Insertion order respects foreign keys: Company → User → Account/Session → …
results.Company = await copy("Company", (r) => {
  const data = {
    id: r.id as string,
    businessName: (r.businessName as string) ?? "",
    websiteUrl: str(r.websiteUrl),
    logoUrl: str(r.logoUrl),
    heroImageUrl: str(r.heroImageUrl),
    primaryColorHex: (r.primaryColorHex as string) ?? "#2563EB",
    contactPhone: str(r.contactPhone),
    contactEmail: str(r.contactEmail),
    vanitySlug: str(r.vanitySlug),
    customSubdomain: str(r.customSubdomain),
    customDomain: str(r.customDomain),
    individualUrlEnabled: toBool(r.individualUrlEnabled),
    tierType: (r.tierType as string) ?? "starter",
    squareCustomerId: str(r.squareCustomerId),
    squareCardId: str(r.squareCardId),
    squareSubscriptionId: str(r.squareSubscriptionId),
    subscriptionStatus: (r.subscriptionStatus as string) ?? "unpaid",
    notificationEmail: str(r.notificationEmail),
    resendApiKey: str(r.resendApiKey),
    resendFromEmail: str(r.resendFromEmail),
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.company.upsert({ where: { id: data.id }, create: data, update: data })
})

results.User = await copy("User", (r) => {
  const data = {
    id: r.id as string,
    companyId: str(r.companyId),
    name: (r.name as string) ?? "",
    email: r.email as string,
    emailVerified: toBool(r.emailVerified),
    image: str(r.image),
    role: (r.role as string) ?? "admin",
    isAdmin: toBool(r.isAdmin),
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.user.upsert({ where: { id: data.id }, create: data, update: data })
})

results.Account = await copy("Account", (r) => {
  const data = {
    id: r.id as string,
    accountId: r.accountId as string,
    providerId: r.providerId as string,
    userId: r.userId as string,
    accessToken: str(r.accessToken),
    refreshToken: str(r.refreshToken),
    idToken: str(r.idToken),
    accessTokenExpiresAt: toDate(r.accessTokenExpiresAt),
    refreshTokenExpiresAt: toDate(r.refreshTokenExpiresAt),
    scope: str(r.scope),
    // Better Auth's own hash, copied as an opaque string — passwords keep working.
    password: str(r.password),
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.account.upsert({ where: { id: data.id }, create: data, update: data })
})

results.Session = await copy("Session", (r) => {
  const data = {
    id: r.id as string,
    expiresAt: toDate(r.expiresAt) ?? new Date(),
    token: r.token as string,
    ipAddress: str(r.ipAddress),
    userAgent: str(r.userAgent),
    userId: r.userId as string,
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.session.upsert({ where: { id: data.id }, create: data, update: data })
})

results.Verification = await copy("Verification", (r) => {
  const data = {
    id: r.id as string,
    identifier: r.identifier as string,
    value: r.value as string,
    expiresAt: toDate(r.expiresAt) ?? new Date(),
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  }
  return prisma.verification.upsert({ where: { id: data.id }, create: data, update: data })
})

results.RepairSettings = await copy("RepairSettings", (r) => {
  const data = {
    id: r.id as string,
    companyId: r.companyId as string,
    enabled: toBool(r.enabled),
    twoCarMultiplier: toNum(r.twoCarMultiplier, 1.6),
    tallMultiplier: toNum(r.tallMultiplier, 1.15),
    vinylMultiplier: toNum(r.vinylMultiplier, 1.15),
    steelMultiplier: toNum(r.steelMultiplier, 1.35),
    serviceCallFee: toNum(r.serviceCallFee, 0),
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.repairSettings.upsert({ where: { id: data.id }, create: data, update: data })
})

results.RepairPrice = await copy("RepairPrice", (r) => {
  const data = {
    id: r.id as string,
    settingsId: r.settingsId as string,
    repairKey: r.repairKey as string,
    basePrice: toNum(r.basePrice, 0),
    enabled: toBool(r.enabled),
  }
  return prisma.repairPrice.upsert({ where: { id: data.id }, create: data, update: data })
})

results.Lead = await copy("Lead", (r) => {
  const data = {
    id: r.id as string,
    companyId: str(r.companyId),
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    zipCode: str(r.zipCode),
    styleId: str(r.styleId),
    styleName: str(r.styleName),
    colorName: str(r.colorName),
    manufacturerName: str(r.manufacturerName),
    windowOption: str(r.windowOption),
    notes: str(r.notes),
    source: str(r.source),
    beforeImageBase64: str(r.beforeImageBase64),
    afterImageBase64: str(r.afterImageBase64),
    status: (r.status as string) ?? "new",
    serviceType: str(r.serviceType),
    estimateTotal:
      r.estimateTotal === null || r.estimateTotal === undefined
        ? null
        : toNum(r.estimateTotal, 0),
    repairSummary: str(r.repairSummary),
    createdAt: toDate(r.createdAt) ?? new Date(),
  }
  return prisma.lead.upsert({ where: { id: data.id }, create: data, update: data })
})

// Compare against the counts the Vibecode studio reported, so a silently
// truncated export cannot pass as a clean import.
const EXPECTED: Record<string, number> = {
  Company: 5,
  User: 7,
  Session: 35,
  Account: 7,
  Verification: 0,
  Lead: 1,
  RepairSettings: 3,
  RepairPrice: 22,
}

console.log("\nAgainst the row counts reported by the Vibecode studio:")
let mismatch = false
for (const [table, expected] of Object.entries(EXPECTED)) {
  const got = results[table]?.ok ?? 0
  const flag = got === expected ? "ok" : "*** MISMATCH ***"
  if (got !== expected) mismatch = true
  console.log(`  ${table.padEnd(16)} expected ${String(expected).padStart(3)}  imported ${String(got).padStart(3)}  ${flag}`)
}

const anyFailed = Object.values(results).some((r) => r.failed > 0)
if (mismatch || anyFailed) {
  console.error("\nImport did NOT match expectations — do not cut over yet.")
} else {
  console.log("\nAll tables match. Log in with an existing account to confirm the password works.")
}

await prisma.$disconnect()
