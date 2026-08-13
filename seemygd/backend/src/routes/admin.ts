import { Hono } from "hono"
import { z } from "zod"
import { db } from "../prisma"
import { auth } from "../auth"
import { createPreviewToken, normalizePreviewSite, PREVIEW_TTL_MS } from "../preview-token"

const adminRouter = new Hono()

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "brokenspringllc@gmail.com"

// Middleware: allow super admin by session email OR x-admin-secret header
adminRouter.use("*", async (c, next) => {
  // Option 1: x-admin-secret header (for programmatic / testing access)
  const secret = c.req.header("x-admin-secret")
  const expected = process.env.ADMIN_SECRET
  if (expected && secret && secret === expected) {
    await next()
    return
  }

  // Option 2: Session-based — user must be logged in as super admin or have isAdmin flag
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user?.id) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403)
  }
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403)
  }
  if (user.email !== SUPER_ADMIN_EMAIL && !user.isAdmin) {
    return c.json({ error: { message: "Forbidden", code: "FORBIDDEN" } }, 403)
  }
  await next()
})

// GET /api/admin/companies — list all companies with users
adminRouter.get("/companies", async (c) => {
  const companies = await db.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, isAdmin: true, createdAt: true },
      },
      _count: { select: { leads: true } },
    },
  })
  return c.json({ data: companies })
})

// GET /api/admin/companies/:id — get a single company
adminRouter.get("/companies/:id", async (c) => {
  const id = c.req.param("id")
  const company = await db.company.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, isAdmin: true, createdAt: true },
      },
      leads: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  })
  if (!company) {
    return c.json({ error: { message: "Company not found", code: "NOT_FOUND" } }, 404)
  }
  return c.json({ data: company })
})

const updateCompanyAdminSchema = z.object({
  businessName: z.string().min(1).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  subscriptionStatus: z
    .enum(["unpaid", "pending", "active", "canceled", "paused", "inactive", "past_due"])
    .optional(),
  tierType: z.enum(["free", "starter", "growth"]).optional(),
  squareCustomerId: z.string().optional(),
  squareSubscriptionId: z.string().optional(),
})

// PATCH /api/admin/companies/:id — update a company (subscription, tier, etc.)
adminRouter.patch("/companies/:id", async (c) => {
  const id = c.req.param("id")

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  const parsed = updateCompanyAdminSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          code: "VALIDATION_ERROR",
        },
      },
      400
    )
  }

  const data = { ...parsed.data } as {
    businessName?: string
    contactEmail?: string
    contactPhone?: string
    websiteUrl?: string
    subscriptionStatus?: string
    tierType?: string
    squareCustomerId?: string
    squareSubscriptionId?: string
  }

  const company = await db.company.update({ where: { id }, data })
  return c.json({ data: company })
})

// DELETE /api/admin/companies/:id — delete a company and all its data
adminRouter.delete("/companies/:id", async (c) => {
  const id = c.req.param("id")

  await db.user.updateMany({ where: { companyId: id }, data: { companyId: null } })
  await db.lead.deleteMany({ where: { companyId: id } })
  await db.company.delete({ where: { id } })

  return c.json({ data: { deleted: true } })
})

// GET /api/admin/users — list all users
adminRouter.get("/users", async (c) => {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: {
          id: true,
          businessName: true,
          subscriptionStatus: true,
          tierType: true,
        },
      },
    },
  })
  return c.json({ data: users })
})

const updateUserAdminSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  isAdmin: z.boolean().optional(),
  role: z.string().optional(),
  companyId: z.string().nullable().optional(),
})

// PATCH /api/admin/users/:id — update user flags
adminRouter.patch("/users/:id", async (c) => {
  const id = c.req.param("id")

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  const updateData: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim().length > 0) updateData.name = body.name.trim()
  if (typeof body.email === "string" && body.email.includes("@")) updateData.email = body.email.trim()
  if (typeof body.isAdmin === "boolean") updateData.isAdmin = body.isAdmin
  if (typeof body.role === "string") updateData.role = body.role
  if (body.companyId === null || typeof body.companyId === "string") updateData.companyId = body.companyId

  const user = await db.user.update({ where: { id }, data: updateData })
  return c.json({ data: user })
})

// POST /api/admin/activate-company/:id — shortcut to activate a company's subscription
adminRouter.post("/activate-company/:id", async (c) => {
  const id = c.req.param("id")
  const company = await db.company.update({
    where: { id },
    data: { subscriptionStatus: "active" },
  })
  return c.json({ data: company })
})

// GET /api/admin/stats — overall platform stats
adminRouter.get("/stats", async (c) => {
  const [totalCompanies, activeCompanies, totalLeads, totalUsers] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { subscriptionStatus: "active" } }),
    db.lead.count(),
    db.user.count(),
  ])

  const tierBreakdown = await db.company.groupBy({
    by: ["tierType"],
    _count: { _all: true },
    where: { subscriptionStatus: "active" },
  })

  const tierMap: Record<string, number> = {}
  for (const t of tierBreakdown) tierMap[t.tierType ?? "starter"] = t._count._all

  return c.json({
    data: {
      totalCompanies,
      activeCompanies,
      totalLeads,
      totalUsers,
      tierBreakdown: {
        free: tierMap["free"] ?? 0,
        starter: tierMap["starter"] ?? 0,
        growth: tierMap["growth"] ?? 0,
      },
    },
  })
})

// POST /api/admin/preview-url — generate a shareable, admin-only preview link.
// Given a prospect's website, returns a signed URL that renders the branded
// visualizer (scraped live from that site) and self-expires after 48h. No
// data is stored — the link is entirely self-contained. Admin-only (guarded by
// the middleware above); clients can never reach this route.
adminRouter.post("/preview-url", async (c) => {
  let body: { site?: string } = {}
  try { body = await c.req.json() } catch { /* ok */ }

  const site = normalizePreviewSite(body.site ?? "")
  if (!site) {
    return c.json({ error: { message: "Enter a valid website, e.g. smithgaragedoors.com", code: "VALIDATION_ERROR" } }, 400)
  }

  const token = createPreviewToken(site)
  // Build the absolute URL from the origin the admin is on (falls back to
  // configured BACKEND_URL host) so it works on newdoor.vibecode.run, previews, etc.
  let origin = c.req.header("origin") || ""
  if (!origin) {
    try { origin = new URL(c.req.header("referer") || process.env.BACKEND_URL || "").origin } catch { origin = "" }
  }
  const qs = `site=${encodeURIComponent(token.site)}&expires=${token.expires}&sig=${token.sig}`
  const url = origin ? `${origin}/preview?${qs}` : `/preview?${qs}`

  return c.json({
    data: {
      site: token.site,
      url,
      expires: token.expires,
      expiresAt: new Date(token.expires).toISOString(),
      ttlHours: Math.round(PREVIEW_TTL_MS / 3_600_000),
    },
  })
})

// GET /api/admin/me — check if current user has admin access
adminRouter.get("/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  return c.json({ data: { isAdmin: true, email: session?.user?.email } })
})

// POST /api/admin/users/:id/reset-password — set a new password for a user
adminRouter.post("/users/:id/reset-password", async (c) => {
  const id = c.req.param("id")
  const user = await db.user.findUnique({ where: { id } })
  if (!user) return c.json({ error: { message: "User not found" } }, 404)

  let body: { newPassword?: string } = {}
  try { body = await c.req.json() } catch { /* empty body ok */ }

  if (!body.newPassword) {
    return c.json({ error: { message: "newPassword is required" } }, 400)
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: { message: "Password must be at least 8 characters" } }, 400)
  }

  // Hash with Better Auth's OWN hasher (via its runtime context) so the stored
  // credential is verifiable at login. Bun.password/argon2id is NOT compatible
  // with Better Auth's verifier — it produces a hash that makes sign-in 500.
  const ctx = await auth.$context
  const hash = await ctx.password.hash(body.newPassword)
  const updated = await db.account.updateMany({
    where: { userId: id, providerId: "credential" },
    data: { password: hash },
  })
  if (updated.count === 0) {
    return c.json({ error: { message: "This user has no password login to reset" } }, 400)
  }

  return c.json({ data: { success: true } })
})

// DELETE /api/admin/users/:id — delete a user
adminRouter.delete("/users/:id", async (c) => {
  const id = c.req.param("id")
  await db.session.deleteMany({ where: { userId: id } })
  await db.account.deleteMany({ where: { userId: id } })
  await db.user.delete({ where: { id } })
  return c.json({ data: { deleted: true } })
})

// POST /api/admin/create-user — create a new user (with optional company)
adminRouter.post("/create-user", async (c) => {
  let body: { name?: string; email?: string; password?: string; businessName?: string; tier?: string; activateNow?: boolean } = {}
  try { body = await c.req.json() } catch { /* ok */ }

  const { name, password, businessName, tier, activateNow } = body
  if (!name || !body.email || !password) {
    return c.json({ error: { message: "name, email, password are required" } }, 400)
  }
  if (password.length < 8) {
    return c.json({ error: { message: "Password must be at least 8 characters" } }, 400)
  }
  // Better Auth normalizes emails to lowercase; match that here so the duplicate
  // check and stored records stay consistent (avoids a case-mismatch 500).
  const email = body.email.trim().toLowerCase()

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return c.json({ error: { message: "User already exists" } }, 409)

  try {
    await auth.api.signUpEmail({ body: { name, email, password } })
    const newUser = await db.user.findUnique({ where: { email } })
    if (!newUser) throw new Error("User creation failed")

    if (businessName) {
      const company = await db.company.create({
        data: {
          businessName,
          contactEmail: email,
          tierType: tier || "starter",
          subscriptionStatus: activateNow ? "active" : "unpaid",
          // New clients get the embed code only — no individualized /v/ URL.
          individualUrlEnabled: false,
          users: { connect: { id: newUser.id } },
        },
      })
      await db.user.update({ where: { id: newUser.id }, data: { companyId: company.id } })
    }

    const result = await db.user.findUnique({ where: { email }, include: { company: true } })
    return c.json({ data: result })
  } catch (err: any) {
    return c.json({ error: { message: err.message || "Failed to create user" } }, 500)
  }
})

// POST /api/admin/companies/:id/users — add another login to an existing company
adminRouter.post("/companies/:id/users", async (c) => {
  const companyId = c.req.param("id")
  let body: { name?: string; email?: string; password?: string } = {}
  try { body = await c.req.json() } catch { /* ok */ }

  const { name, password } = body
  if (!name || !body.email || !password) {
    return c.json({ error: { message: "name, email, password are required" } }, 400)
  }
  if (password.length < 8) {
    return c.json({ error: { message: "Password must be at least 8 characters" } }, 400)
  }
  const email = body.email.trim().toLowerCase()

  const company = await db.company.findUnique({ where: { id: companyId } })
  if (!company) return c.json({ error: { message: "Company not found", code: "NOT_FOUND" } }, 404)

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return c.json({ error: { message: "User already exists" } }, 409)

  try {
    await auth.api.signUpEmail({ body: { name, email, password } })
    const newUser = await db.user.findUnique({ where: { email } })
    if (!newUser) throw new Error("User creation failed")

    await db.user.update({ where: { id: newUser.id }, data: { companyId } })

    const result = await db.user.findUnique({ where: { email }, include: { company: true } })
    return c.json({ data: result })
  } catch (err: any) {
    return c.json({ error: { message: err.message || "Failed to create user" } }, 500)
  }
})

// POST /api/admin/payments/charge — manual charge on saved card
adminRouter.post("/payments/charge", async (c) => {
  let body: { companyId?: string; amount?: number; note?: string } = {}
  try { body = await c.req.json() } catch { /* ok */ }

  const { companyId, amount, note } = body
  if (!companyId) return c.json({ error: { message: "companyId required" } }, 400)

  const company = await db.company.findUnique({ where: { id: companyId } })
  if (!company) return c.json({ error: { message: "Company not found" } }, 404)

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) {
    return c.json({ error: { message: "Square not configured — add SQUARE_ACCESS_TOKEN to ENV" } }, 503)
  }
  if (!company.squareCustomerId) {
    return c.json({ error: { message: "No Square customer on file for this company" } }, 400)
  }

  try {
    const { SquareClient, SquareEnvironment } = await import("square")
    const client = new SquareClient({
      token,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    })

    const page = await client.cards.list({ customerId: company.squareCustomerId })
    const cards = (page.data ?? []).filter((card) => card.enabled !== false)
    if (cards.length === 0) {
      return c.json({ error: { message: "No card on file for this customer" } }, 400)
    }

    const card = cards[0]
    if (!card?.id) {
      return c.json({ error: { message: "No usable card on file for this customer" } }, 400)
    }
    // amount is in dollars from frontend; convert to cents for Square
    const tierDefault = company.tierType === "growth" ? 99 : company.tierType === "free" ? 0 : 49
    const dollarAmount = amount || tierDefault
    const chargeAmount = BigInt(Math.round(dollarAmount * 100))

    const { payment } = await client.payments.create({
      sourceId: card.id!,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: chargeAmount, currency: "USD" },
      customerId: company.squareCustomerId,
      locationId: process.env.SQUARE_LOCATION_ID || undefined,
      note: note || `Manual charge - ${company.businessName}`,
    })

    if (payment?.status !== "COMPLETED" && payment?.status !== "APPROVED") {
      return c.json({ error: { message: "Charge was not approved" } }, 400)
    }

    const updated = await db.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: "active" },
    })

    return c.json({ data: { payment, company: updated } })
  } catch (err: any) {
    const message = err?.errors?.[0]?.detail || err?.message || "Charge failed"
    return c.json({ error: { message } }, 400)
  }
})

// GET /api/admin/payments/cards/:companyId — list saved cards for a company
adminRouter.get("/payments/cards/:companyId", async (c) => {
  const company = await db.company.findUnique({ where: { id: c.req.param("companyId") } })
  if (!company?.squareCustomerId) return c.json({ data: { cards: [] } })

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return c.json({ data: { cards: [] } })

  try {
    const { SquareClient, SquareEnvironment } = await import("square")
    const client = new SquareClient({
      token,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    })
    const page = await client.cards.list({ customerId: company.squareCustomerId })
    const cards = (page.data ?? [])
      .filter((card) => card.enabled !== false)
      .map((card) => ({
        id: card.id,
        last4: card.last4,
        brand: card.cardBrand,
        expMonth: Number(card.expMonth ?? 0),
        expYear: Number(card.expYear ?? 0),
      }))
    return c.json({ data: cards[0] || null })
  } catch {
    return c.json({ data: { cards: [] } })
  }
})

export { adminRouter }
