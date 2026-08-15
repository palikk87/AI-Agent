import { Hono } from "hono";
import { db } from "../prisma";
import { auth } from "../auth";
import {
  UpdateRepairSettingsSchema,
  DEFAULT_REPAIR_MULTIPLIERS,
  effectiveRepairPrices,
  REPAIR_CATALOG,
  type RepairPricingResponse,
} from "../types";

const repairRouter = new Hono();

async function requireSession(c: { req: { raw: Request } }) {
  return auth.api.getSession({ headers: c.req.raw.headers });
}

// A RepairSettings row with its prices relation (all fields nullable/optional
// so this works whether the row exists or not).
type SettingsWithPrices =
  | ({
      enabled: boolean;
      twoCarMultiplier: number;
      tallMultiplier: number;
      vinylMultiplier: number;
      steelMultiplier: number;
      serviceCallFee: number;
      prices: { repairKey: string; basePrice: number; enabled: boolean }[];
    })
  | null;

// Build the shared pricing response from a company's RepairSettings row (which
// may be null — in which case catalog + default multiplier values are used).
function buildPricingResponse(settings: SettingsWithPrices): RepairPricingResponse {
  return {
    enabled: settings?.enabled ?? true,
    multipliers: {
      twoCarMultiplier: settings?.twoCarMultiplier ?? DEFAULT_REPAIR_MULTIPLIERS.twoCarMultiplier,
      tallMultiplier: settings?.tallMultiplier ?? DEFAULT_REPAIR_MULTIPLIERS.tallMultiplier,
      vinylMultiplier: settings?.vinylMultiplier ?? DEFAULT_REPAIR_MULTIPLIERS.vinylMultiplier,
      steelMultiplier: settings?.steelMultiplier ?? DEFAULT_REPAIR_MULTIPLIERS.steelMultiplier,
      serviceCallFee: settings?.serviceCallFee ?? DEFAULT_REPAIR_MULTIPLIERS.serviceCallFee,
    },
    prices: effectiveRepairPrices(settings?.prices ?? []),
  };
}

// Public: pricing for the homeowner estimator. :idOrSlug is the company cuid
// OR its vanity slug (like the branding endpoint).
repairRouter.get("/:idOrSlug/pricing", async (c) => {
  const idOrSlug = c.req.param("idOrSlug");
  const company = await db.company.findFirst({
    where: { OR: [{ id: idOrSlug }, { vanitySlug: idOrSlug }] },
    include: { repairSettings: { include: { prices: true } } },
  });
  if (!company) {
    return c.json({ error: { message: "Company not found", code: "NOT_FOUND" } }, 404);
  }
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return c.json({ data: buildPricingResponse(company.repairSettings) });
});

// Auth: owner reads their current repair settings for the dashboard.
repairRouter.get("/settings", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: { include: { repairSettings: { include: { prices: true } } } } },
  });
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404);
  }
  return c.json({ data: buildPricingResponse(user.company.repairSettings) });
});

// Auth: owner updates multipliers + per-repair prices from the dashboard.
repairRouter.put("/settings", async (c) => {
  const session = await requireSession(c);
  if (!session) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { company: true },
  });
  if (!user?.company) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404);
  }
  const companyId = user.company.id;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = UpdateRepairSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    );
  }
  const input = parsed.data;

  // Only set multiplier/enabled fields that are actually present in the body.
  const multiplierFields: {
    enabled?: boolean;
    twoCarMultiplier?: number;
    tallMultiplier?: number;
    vinylMultiplier?: number;
    steelMultiplier?: number;
    serviceCallFee?: number;
  } = {};
  if (input.enabled !== undefined) multiplierFields.enabled = input.enabled;
  if (input.twoCarMultiplier !== undefined) multiplierFields.twoCarMultiplier = input.twoCarMultiplier;
  if (input.tallMultiplier !== undefined) multiplierFields.tallMultiplier = input.tallMultiplier;
  if (input.vinylMultiplier !== undefined) multiplierFields.vinylMultiplier = input.vinylMultiplier;
  if (input.steelMultiplier !== undefined) multiplierFields.steelMultiplier = input.steelMultiplier;
  if (input.serviceCallFee !== undefined) multiplierFields.serviceCallFee = input.serviceCallFee;

  const settings = await db.repairSettings.upsert({
    where: { companyId },
    create: { companyId, ...multiplierFields },
    update: { ...multiplierFields },
  });

  // Upsert per-repair prices, ignoring any repairKey not in the known catalog.
  if (input.prices && input.prices.length > 0) {
    const validKeys = new Set(REPAIR_CATALOG.map((r) => r.key));
    for (const p of input.prices) {
      if (!validKeys.has(p.repairKey)) continue;
      await db.repairPrice.upsert({
        where: { settingsId_repairKey: { settingsId: settings.id, repairKey: p.repairKey } },
        create: { settingsId: settings.id, repairKey: p.repairKey, basePrice: p.basePrice },
        update: { basePrice: p.basePrice },
      });
    }
  }

  // Re-read the full row (with prices) and return the pricing response.
  const fresh = await db.repairSettings.findUnique({
    where: { companyId },
    include: { prices: true },
  });
  return c.json({ data: buildPricingResponse(fresh) });
});

export { repairRouter };
