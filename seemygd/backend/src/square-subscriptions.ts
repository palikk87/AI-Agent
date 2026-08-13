import { SquareClient, SquareEnvironment } from "square"

/**
 * Helpers for real recurring monthly billing via Square Subscriptions.
 *
 * Square subscriptions bill against a Catalog "subscription plan variation"
 * which defines the cadence (MONTHLY) and price. We create those plans once,
 * lazily, and cache their IDs so every customer on a tier subscribes to the
 * same plan. The customer's card is saved on file and Square automatically
 * rebills it each month until the subscription is canceled.
 */

export type Tier = "starter" | "growth"

const TIER_PLAN = {
  starter: { planName: "DoorViz Starter", priceMonthly: 4900 },
  growth: { planName: "DoorViz Growth", priceMonthly: 9900 },
} as const

// Variation name we look for / create — unique per tier so we can find it again.
function variationName(tier: Tier): string {
  return `${TIER_PLAN[tier].planName} — Monthly`
}

export function getSquareClient(): SquareClient {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not configured")
  const environment =
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox
  return new SquareClient({ token, environment })
}

// In-process cache of resolved plan variation IDs (survives within a server run).
const planVariationCache: Partial<Record<Tier, string>> = {}

/**
 * Returns the Square catalog plan-variation ID for a tier, creating the
 * subscription plan + monthly variation in the Square catalog if it doesn't
 * exist yet. Idempotent across restarts because we search by name first.
 */
export async function getOrCreatePlanVariationId(tier: Tier): Promise<string> {
  if (planVariationCache[tier]) return planVariationCache[tier] as string

  const client = getSquareClient()
  const wantName = variationName(tier)

  // 1. Try to find an existing variation with our name.
  try {
    const search = await client.catalog.search({
      objectTypes: ["SUBSCRIPTION_PLAN_VARIATION"],
    })
    const existing = (search.objects ?? []).find(
      (o) =>
        o.type === "SUBSCRIPTION_PLAN_VARIATION" &&
        o.subscriptionPlanVariationData?.name === wantName
    )
    if (existing?.id) {
      planVariationCache[tier] = existing.id
      return existing.id
    }
  } catch {
    // fall through to creation
  }

  // 2. Create the plan + monthly variation in one batch.
  const planTempId = `#plan-${tier}`
  const variationTempId = `#var-${tier}`
  const res = await client.catalog.batchUpsert({
    idempotencyKey: `plan-${tier}-${TIER_PLAN[tier].priceMonthly}`,
    batches: [
      {
        objects: [
          {
            type: "SUBSCRIPTION_PLAN",
            id: planTempId,
            subscriptionPlanData: {
              name: TIER_PLAN[tier].planName,
              subscriptionPlanVariations: [
                {
                  type: "SUBSCRIPTION_PLAN_VARIATION",
                  id: variationTempId,
                  subscriptionPlanVariationData: {
                    name: wantName,
                    phases: [
                      {
                        cadence: "MONTHLY",
                        // Square API 2026+ requires price on `pricing` (STATIC),
                        // not the legacy `recurringPriceMoney` field.
                        pricing: {
                          type: "STATIC",
                          priceMoney: {
                            amount: BigInt(TIER_PLAN[tier].priceMonthly),
                            currency: "USD",
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  })

  // Map the temp variation id to the real id Square assigned.
  const mapping = (res.idMappings ?? []).find((m) => m.clientObjectId === variationTempId)
  const realId = mapping?.objectId
  if (!realId) throw new Error("Failed to create Square subscription plan variation")
  planVariationCache[tier] = realId
  return realId
}
