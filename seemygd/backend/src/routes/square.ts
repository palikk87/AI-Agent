import { Hono } from "hono"
import { z } from "zod"
import { auth } from "../auth"
import { db } from "../prisma"
import { SquareClient, SquareEnvironment } from "square"
import { getOrCreatePlanVariationId } from "../square-subscriptions"

const squareRouter = new Hono()

function getSquareClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not configured")
  const environment =
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox
  return new SquareClient({ token, environment })
}

async function requireSession(c: { req: { raw: Request } }) {
  return auth.api.getSession({ headers: c.req.raw.headers })
}

// Pricing tiers definition
const TIERS = {
  starter: {
    name: "Starter",
    priceMonthly: 4900, // cents = $49/month
    features: [
      "Branded visualizer link",
      "Automated brand/logo matching",
      "Email lead delivery",
      "Powered by DoorViz Pro badge",
    ],
  },
  growth: {
    name: "Growth",
    priceMonthly: 9900, // cents = $99/month
    features: [
      "Fully white-labeled (no badge)",
      "Custom domain support",
      "Lead management dashboard",
      "Priority support",
    ],
  },
} as const

export type TierKey = keyof typeof TIERS

// GET /api/square/plans — return available plans (public)
squareRouter.get("/plans", (c) => {
  const plans = Object.entries(TIERS).map(([key, value]) => ({
    id: key as TierKey,
    name: value.name,
    priceMonthly: value.priceMonthly,
  }))
  return c.json({ data: plans })
})

// GET /api/square/config — public config the frontend needs to render the
// embedded Square card form (Web Payments SDK). Safe to expose: the
// application ID and location ID are publishable client-side identifiers.
squareRouter.get("/config", (c) => {
  return c.json({
    data: {
      applicationId: process.env.SQUARE_APPLICATION_ID ?? null,
      locationId: process.env.SQUARE_LOCATION_ID ?? null,
      environment: process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
    },
  })
})

const paySchema = z.object({
  tier: z.enum(["starter", "growth"]),
  // The single-use payment token produced by the Square Web Payments SDK
  // (card.tokenize()) on the frontend. The raw card number never touches us.
  sourceId: z.string().min(1),
})

// POST /api/square/pay — start a real recurring MONTHLY subscription.
//
// Flow (all server-side, card number never touches us):
//   1. Save the tokenized card on file for a Square Customer.
//   2. Create a Square Subscription on the tier's monthly plan, billed to that
//      card. Square charges immediately and auto-rebills every month.
// We only activate the company once Square confirms the subscription exists.
squareRouter.post("/pay", async (c) => {
  const session = await requireSession(c)
  if (!session)
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  const parsed = paySchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    )
  }

  const { tier, sourceId } = parsed.data

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }
  const company = user.company

  const locationId = process.env.SQUARE_LOCATION_ID
  if (!locationId) {
    return c.json({ error: { message: "Payments not configured", code: "SQUARE_ERROR" } }, 500)
  }

  try {
    const client = getSquareClient()
    const planVariationId = await getOrCreatePlanVariationId(tier)

    // 1. Customer (reuse if we've created one for this company before).
    let customerId = company.squareCustomerId
    if (!customerId) {
      const cust = await client.customers.create({
        idempotencyKey: crypto.randomUUID(),
        emailAddress: session.user.email,
        companyName: company.businessName,
        referenceId: company.id,
      })
      customerId = cust.customer?.id ?? null
    }
    if (!customerId) throw new Error("Could not create Square customer")

    // 2. Save the card on file from the single-use token.
    const cardResp = await client.cards.create({
      idempotencyKey: crypto.randomUUID(),
      sourceId,
      card: { customerId },
    })
    const cardId = cardResp.card?.id
    if (!cardId) throw new Error("Card could not be saved")

    // 3. If switching plans, cancel the previous subscription first.
    if (company.squareSubscriptionId) {
      await client.subscriptions
        .cancel({ subscriptionId: company.squareSubscriptionId })
        .catch(() => {})
    }

    // 4. Create the recurring monthly subscription billed to that card.
    const subResp = await client.subscriptions.create({
      idempotencyKey: crypto.randomUUID(),
      locationId,
      planVariationId,
      customerId,
      cardId,
    })
    const subscription = subResp.subscription
    const subStatus = subscription?.status // ACTIVE | PENDING | ...
    if (!subscription?.id || (subStatus !== "ACTIVE" && subStatus !== "PENDING")) {
      return c.json(
        { error: { message: "Subscription could not be started", code: "PAYMENT_FAILED" } },
        402
      )
    }

    const updated = await db.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: "active",
        tierType: tier,
        squareCustomerId: customerId,
        squareCardId: cardId,
        squareSubscriptionId: subscription.id,
      },
    })

    return c.json({
      data: {
        subscriptionStatus: updated.subscriptionStatus,
        tierType: updated.tierType,
        subscriptionId: subscription.id,
      },
    })
  } catch (err) {
    console.error("Square subscription error:", err)
    return c.json(
      {
        error: {
          message:
            "Payment could not be processed. Please check your card details and try again.",
          code: "SQUARE_ERROR",
        },
      },
      400
    )
  }
})

const createCheckoutSchema = z.object({
  tier: z.enum(["starter", "growth"]),
  redirectOrigin: z.string().url().optional(),
})

// POST /api/square/create-checkout — create a Square payment link for subscription
squareRouter.post("/create-checkout", async (c) => {
  const session = await requireSession(c)
  if (!session)
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400)
  }

  const parsed = createCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    )
  }

  const { tier, redirectOrigin } = parsed.data
  const plan = TIERS[tier]

  // Prefer the origin the user is actually on so Square returns them to the
  // right place (preview / production / custom domain). Fall back to env.
  const returnBase =
    redirectOrigin ||
    process.env.VITE_BASE_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:8000"

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }

  try {
    const client = getSquareClient()
    const idempotencyKey = `checkout-${user.company.id}-${tier}-${Date.now()}`

    const response = await client.checkout.paymentLinks.create({
      idempotencyKey,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID || "",
        lineItems: [
          {
            name: `${plan.name} Plan — Monthly Subscription`,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(plan.priceMonthly),
              currency: "USD",
            },
          },
        ],
        referenceId: user.company.id,
      },
      checkoutOptions: {
        redirectUrl: `${returnBase}/dashboard?payment=success`,
        askForShippingAddress: false,
        merchantSupportEmail: user.company.contactEmail ?? undefined,
      },
      prePopulatedData: {
        buyerEmail: session.user.email,
      },
    })

    const link = response.paymentLink
    if (!link?.url) {
      return c.json(
        { error: { message: "Failed to create checkout link", code: "SQUARE_ERROR" } },
        500
      )
    }

    // Mark subscription as pending
    await db.company.update({
      where: { id: user.company.id },
      data: {
        subscriptionStatus: "pending",
        tierType: tier,
      },
    })

    return c.json({ data: { checkoutUrl: link.url, orderId: link.orderId ?? null } })
  } catch (err) {
    console.error("Square checkout error:", err)
    return c.json(
      { error: { message: "Payment service error", code: "SQUARE_ERROR" } },
      500
    )
  }
})

// POST /api/square/webhook — handle Square webhooks
squareRouter.post("/webhook", async (c) => {
  // Verify Square webhook signature
  const signature = c.req.header("x-square-hmacsha256-signature")
  const body = await c.req.text()
  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY

  if (sigKey && signature) {
    const url = `${process.env.BACKEND_URL || "http://localhost:3000"}/api/square/webhook`
    const crypto = await import("crypto")
    const expected = crypto
      .createHmac("sha256", sigKey)
      .update(url + body)
      .digest("base64")
    if (signature !== expected) {
      return c.json({ error: { message: "Invalid signature", code: "FORBIDDEN" } }, 403)
    }
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body) as Record<string, unknown>
  } catch {
    return c.json({ error: { message: "Invalid JSON", code: "BAD_REQUEST" } }, 400)
  }

  const eventType = event.type as string
  console.log("Square webhook event:", eventType)

  if (
    eventType === "payment.completed" ||
    eventType === "order.updated" ||
    eventType === "order.fulfillment.updated"
  ) {
    const data = event.data as Record<string, unknown> | undefined
    const obj = data?.object as Record<string, unknown> | undefined
    const order = obj?.order_created as Record<string, unknown> | undefined
    const referenceId = (order?.reference_id ?? obj?.reference_id ?? data?.id) as
      | string
      | undefined

    if (referenceId) {
      await db.company.update({
        where: { id: referenceId },
        data: { subscriptionStatus: "active" },
      }).catch((err) => {
        console.error("Failed to update company subscription:", err)
      })
    }
  }

  if (eventType === "subscription.updated" || eventType === "subscription.created") {
    const data = event.data as Record<string, unknown> | undefined
    const obj = data?.object as Record<string, unknown> | undefined
    const subscription = obj?.subscription as Record<string, unknown> | undefined
    // The subscription id is what we stored on the company at checkout.
    const subscriptionId = (subscription?.id ?? data?.id) as string | undefined
    const status = subscription?.status as string | undefined

    if (subscriptionId && status) {
      const mappedStatus =
        status === "ACTIVE"
          ? "active"
          : status === "CANCELED"
          ? "canceled"
          : status === "PAUSED"
          ? "paused"
          : status === "DEACTIVATED"
          ? "canceled"
          : "inactive"
      await db.company
        .updateMany({
          where: { squareSubscriptionId: subscriptionId },
          data: { subscriptionStatus: mappedStatus },
        })
        .catch((err) => {
          console.error("Failed to update company subscription status:", err)
        })
    }
  }

  // A monthly invoice was paid (or failed) — keep the company's access in sync.
  if (eventType === "invoice.payment_made" || eventType === "invoice.scheduled_charge_failed") {
    const data = event.data as Record<string, unknown> | undefined
    const obj = data?.object as Record<string, unknown> | undefined
    const invoice = obj?.invoice as Record<string, unknown> | undefined
    const subscriptionId = invoice?.subscription_id as string | undefined
    if (subscriptionId) {
      const newStatus = eventType === "invoice.payment_made" ? "active" : "past_due"
      await db.company
        .updateMany({
          where: { squareSubscriptionId: subscriptionId },
          data: { subscriptionStatus: newStatus },
        })
        .catch((err) => {
          console.error("Failed to sync invoice status:", err)
        })
    }
  }

  return c.json({ data: { received: true } })
})

// POST /api/square/cancel-subscription — cancel active subscription
squareRouter.post("/cancel-subscription", async (c) => {
  const session = await requireSession(c)
  if (!session)
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }

  const { squareSubscriptionId } = user.company

  try {
    // If this company was set up with a recurring Square subscription, cancel it
    // there too. Payments made through the embedded card flow are one-time
    // charges with no recurring subscription, so there is nothing to cancel at
    // Square — we simply deactivate locally.
    if (squareSubscriptionId) {
      const client = getSquareClient()
      await client.subscriptions.cancel({ subscriptionId: squareSubscriptionId })
    }

    await db.company.update({
      where: { id: user.company.id },
      data: { subscriptionStatus: "canceled" },
    })

    return c.json({ data: { canceled: true } })
  } catch (err) {
    console.error("Square cancel subscription error:", err)
    return c.json(
      { error: { message: "Failed to cancel subscription", code: "SQUARE_ERROR" } },
      500
    )
  }
})

// POST /api/square/confirm-payment — activate subscription after Square redirect
// Square only redirects to redirectUrl on successful payment, so if status is "pending" we can safely activate.
squareRouter.post("/confirm-payment", async (c) => {
  const session = await requireSession(c)
  if (!session)
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  })
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404)
  }

  if (user.company.subscriptionStatus === "pending") {
    const updated = await db.company.update({
      where: { id: user.company.id },
      data: { subscriptionStatus: "active" },
    })
    return c.json({ data: { subscriptionStatus: updated.subscriptionStatus, tierType: updated.tierType } })
  }

  return c.json({
    data: { subscriptionStatus: user.company.subscriptionStatus, tierType: user.company.tierType },
  })
})

// GET /api/square/subscription-status — get current company subscription status
squareRouter.get("/subscription-status", async (c) => {
  const session = await requireSession(c)
  if (!session)
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401)

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

export { squareRouter }
