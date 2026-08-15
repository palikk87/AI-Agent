/**
 * One-shot data migration: Vibecode SQLite  →  Supabase Postgres.
 *
 *   bun scripts/migrate-sqlite-to-postgres.ts <path-to-production.db>
 *
 * Copies every row from the old SQLite database into the Postgres database that
 * DATABASE_URL points at, preserving primary keys. Better Auth's Account.password
 * hashes come across verbatim, so existing owners keep their current passwords —
 * nobody has to reset anything. Sessions are copied too, so anyone logged in
 * right now stays logged in.
 *
 * Safe to re-run: every write is an upsert keyed on the original id, so a partial
 * run can simply be repeated.
 *
 * Run the schema first (`bunx prisma migrate deploy`), then this.
 */

import { Database } from "bun:sqlite"
import { PrismaClient } from "@prisma/client"

const sqlitePath = process.argv[2]
if (!sqlitePath) {
  console.error("Usage: bun scripts/migrate-sqlite-to-postgres.ts <path-to-production.db>")
  process.exit(1)
}

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("DATABASE_URL must point at Postgres (Supabase) before running this.")
  process.exit(1)
}

const sqlite = new Database(sqlitePath, { readonly: true })
const prisma = new PrismaClient()

/**
 * Prisma-on-SQLite stores DateTime as epoch milliseconds and Boolean as 0/1,
 * so values need coercing back into JS types on the way into Postgres.
 */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
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

/** Read every row of a table, tolerating tables absent from older databases. */
function rows(table: string): Record<string, unknown>[] {
  try {
    return sqlite.query(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]
  } catch {
    console.warn(`  (no "${table}" table in the source database — skipping)`)
    return []
  }
}

async function copy(
  label: string,
  table: string,
  upsert: (row: Record<string, unknown>) => Promise<unknown>
) {
  const all = rows(table)
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
  console.log(`${label.padEnd(16)} ${ok}/${all.length} copied${failed ? ` (${failed} failed)` : ""}`)
}

// Insertion order respects foreign keys: Company → User → Session/Account → …
await copy("Company", "Company", (r) => {
  const data = {
    id: r.id as string,
    businessName: r.businessName as string,
    websiteUrl: (r.websiteUrl as string) ?? null,
    logoUrl: (r.logoUrl as string) ?? null,
    heroImageUrl: (r.heroImageUrl as string) ?? null,
    primaryColorHex: (r.primaryColorHex as string) ?? "#2563EB",
    contactPhone: (r.contactPhone as string) ?? null,
    contactEmail: (r.contactEmail as string) ?? null,
    vanitySlug: (r.vanitySlug as string) ?? null,
    customSubdomain: (r.customSubdomain as string) ?? null,
    customDomain: (r.customDomain as string) ?? null,
    individualUrlEnabled: toBool(r.individualUrlEnabled),
    tierType: (r.tierType as string) ?? "starter",
    squareCustomerId: (r.squareCustomerId as string) ?? null,
    squareCardId: (r.squareCardId as string) ?? null,
    squareSubscriptionId: (r.squareSubscriptionId as string) ?? null,
    subscriptionStatus: (r.subscriptionStatus as string) ?? "unpaid",
    notificationEmail: (r.notificationEmail as string) ?? null,
    resendApiKey: (r.resendApiKey as string) ?? null,
    resendFromEmail: (r.resendFromEmail as string) ?? null,
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.company.upsert({ where: { id: data.id }, create: data, update: data })
})

await copy("User", "User", (r) => {
  const data = {
    id: r.id as string,
    companyId: (r.companyId as string) ?? null,
    name: (r.name as string) ?? "",
    email: r.email as string,
    emailVerified: toBool(r.emailVerified),
    image: (r.image as string) ?? null,
    role: (r.role as string) ?? "admin",
    isAdmin: toBool(r.isAdmin),
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.user.upsert({ where: { id: data.id }, create: data, update: data })
})

await copy("Account", "Account", (r) => {
  const data = {
    id: r.id as string,
    accountId: r.accountId as string,
    providerId: r.providerId as string,
    userId: r.userId as string,
    accessToken: (r.accessToken as string) ?? null,
    refreshToken: (r.refreshToken as string) ?? null,
    idToken: (r.idToken as string) ?? null,
    accessTokenExpiresAt: toDate(r.accessTokenExpiresAt),
    refreshTokenExpiresAt: toDate(r.refreshTokenExpiresAt),
    scope: (r.scope as string) ?? null,
    // The password hash moves across as an opaque string — Better Auth's own
    // format (scrypt salt:hash), never re-encoded — so existing passwords keep
    // working. Verified: all hashes byte-identical after a real import.
    password: (r.password as string) ?? null,
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.account.upsert({ where: { id: data.id }, create: data, update: data })
})

await copy("Session", "Session", (r) => {
  const data = {
    id: r.id as string,
    expiresAt: toDate(r.expiresAt) ?? new Date(),
    token: r.token as string,
    ipAddress: (r.ipAddress as string) ?? null,
    userAgent: (r.userAgent as string) ?? null,
    userId: r.userId as string,
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.session.upsert({ where: { id: data.id }, create: data, update: data })
})

await copy("Verification", "Verification", (r) => {
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

await copy("RepairSettings", "RepairSettings", (r) => {
  const data = {
    id: r.id as string,
    companyId: r.companyId as string,
    enabled: toBool(r.enabled),
    twoCarMultiplier: Number(r.twoCarMultiplier ?? 1.6),
    tallMultiplier: Number(r.tallMultiplier ?? 1.15),
    vinylMultiplier: Number(r.vinylMultiplier ?? 1.15),
    steelMultiplier: Number(r.steelMultiplier ?? 1.35),
    serviceCallFee: Number(r.serviceCallFee ?? 0),
    createdAt: toDate(r.createdAt) ?? new Date(),
    updatedAt: toDate(r.updatedAt) ?? new Date(),
  }
  return prisma.repairSettings.upsert({ where: { id: data.id }, create: data, update: data })
})

await copy("RepairPrice", "RepairPrice", (r) => {
  const data = {
    id: r.id as string,
    settingsId: r.settingsId as string,
    repairKey: r.repairKey as string,
    basePrice: Number(r.basePrice ?? 0),
    enabled: toBool(r.enabled),
  }
  return prisma.repairPrice.upsert({ where: { id: data.id }, create: data, update: data })
})

await copy("Lead", "Lead", (r) => {
  const data = {
    id: r.id as string,
    companyId: (r.companyId as string) ?? null,
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    zipCode: (r.zipCode as string) ?? null,
    styleId: (r.styleId as string) ?? null,
    styleName: (r.styleName as string) ?? null,
    colorName: (r.colorName as string) ?? null,
    manufacturerName: (r.manufacturerName as string) ?? null,
    windowOption: (r.windowOption as string) ?? null,
    notes: (r.notes as string) ?? null,
    source: (r.source as string) ?? null,
    beforeImageBase64: (r.beforeImageBase64 as string) ?? null,
    afterImageBase64: (r.afterImageBase64 as string) ?? null,
    status: (r.status as string) ?? "new",
    serviceType: (r.serviceType as string) ?? null,
    estimateTotal: r.estimateTotal === null || r.estimateTotal === undefined ? null : Number(r.estimateTotal),
    repairSummary: (r.repairSummary as string) ?? null,
    createdAt: toDate(r.createdAt) ?? new Date(),
  }
  return prisma.lead.upsert({ where: { id: data.id }, create: data, update: data })
})

console.log("\nDone. Verify in Supabase → Table Editor, then log in to confirm your password still works.")

await prisma.$disconnect()
sqlite.close()
