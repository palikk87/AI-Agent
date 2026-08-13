import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { Resend } from "resend";

const leadsRouter = new Hono();


const CreateLeadSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  zipCode: z.string().max(10).optional(),
  styleId: z.string().optional(),
  styleName: z.string().optional(),
  colorName: z.string().optional(),
  manufacturerName: z.string().optional(),
  windowOption: z.string().optional(),
  notes: z.string().max(500).optional(),
  source: z.string().optional(),
  serviceType: z.string().optional(),
  estimateTotal: z.number().optional(),
  repairSummary: z.string().max(4000).optional(),
  beforeImageBase64: z.string().optional(),
  afterImageBase64: z.string().optional(),
  companyId: z.string().optional(),
});

// GET /api/leads - authenticated, returns company's leads
leadsRouter.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.companyId) {
    return c.json({ data: [] });
  }

  const allLeads = await prisma.lead.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ data: allLeads });
});

leadsRouter.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid JSON body", code: "BAD_REQUEST" } }, 400);
  }

  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" } },
      400
    );
  }

  const lead = await prisma.lead.create({ data: parsed.data });

  // Send email to company's contact email using their Resend key (or platform fallback)
  const d = parsed.data;
  let toEmail = process.env.LEAD_NOTIFICATION_EMAIL || "";
  let companyName = "";
  let resendKey: string | null = null;
  let fromAddress = "DoorViz Pro <onboarding@resend.dev>";

  if (d.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: d.companyId },
      select: { contactEmail: true, notificationEmail: true, businessName: true, resendApiKey: true, resendFromEmail: true },
    });
    // Prefer the dedicated lead-notification email; fall back to the public
    // contact email when the owner hasn't set a separate notification address.
    if (company?.notificationEmail) toEmail = company.notificationEmail;
    else if (company?.contactEmail) toEmail = company.contactEmail;
    if (company?.businessName) companyName = company.businessName;
    if (company?.resendApiKey) resendKey = company.resendApiKey;
    if (company?.resendFromEmail) fromAddress = `${companyName} <${company.resendFromEmail}>`;
  }

  const activeResendKey = resendKey || process.env.RESEND_API_KEY;

  if (activeResendKey && toEmail) {
    const resend = new Resend(activeResendKey);
    const isRepair = d.serviceType === "repair";

    const formattedTotal =
      typeof d.estimateTotal === "number"
        ? `$${Math.round(d.estimateTotal).toLocaleString("en-US")}`
        : null;

    const doorDetails = [
      d.styleName && `Style: ${d.styleName}`,
      d.colorName && `Color: ${d.colorName}`,
      d.manufacturerName && `Manufacturer: ${d.manufacturerName}`,
      d.windowOption && `Windows: ${d.windowOption}`,
    ].filter(Boolean).join("\n");

    const subject = isRepair
      ? `New Repair Request from ${d.name || d.phone || "Unknown"}${companyName ? ` — ${companyName}` : ""}`
      : `New Quote Request from ${d.name || d.phone || "Unknown"}${companyName ? ` — ${companyName}` : ""}`;

    const heading = isRepair
      ? companyName ? `NEW REPAIR REQUEST — ${companyName}` : "NEW REPAIR REQUEST"
      : companyName ? `NEW QUOTE REQUEST — ${companyName}` : "NEW QUOTE REQUEST";

    const body = isRepair
      ? [
          heading,
          "=================",
          d.name && `Name: ${d.name}`,
          d.phone && `Phone: ${d.phone}`,
          d.email && `Email: ${d.email}`,
          d.zipCode && `Zip Code: ${d.zipCode}`,
          formattedTotal && `\nEstimated Total: ${formattedTotal}`,
          d.repairSummary && `\nRepair Details:\n${d.repairSummary}`,
          d.notes && `\nNotes: ${d.notes}`,
          `\nSubmitted: ${new Date().toLocaleString()}`,
        ]
      : [
          heading,
          "=================",
          d.name && `Name: ${d.name}`,
          d.phone && `Phone: ${d.phone}`,
          d.email && `Email: ${d.email}`,
          d.zipCode && `Zip Code: ${d.zipCode}`,
          doorDetails && `\nDoor Details:\n${doorDetails}`,
          d.notes && `\nNotes: ${d.notes}`,
          `\nSubmitted: ${new Date().toLocaleString()}`,
        ];

    resend.emails.send({
      from: fromAddress,
      to: toEmail,
      subject,
      text: body.filter(Boolean).join("\n"),
    }).catch((err: unknown) => console.error("Failed to send lead email:", err));
  }

  return c.json({ data: lead }, 201);
});

// PATCH /api/leads/:id - update lead status (authenticated)
leadsRouter.patch("/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.companyId) {
    return c.json({ error: { message: "No company found", code: "NOT_FOUND" } }, 404);
  }

  const leadId = c.req.param("id");
  const body = await c.req.json();
  const status = body.status as string;

  if (!["new", "contacted"].includes(status)) {
    return c.json({ error: { message: "Invalid status", code: "BAD_REQUEST" } }, 400);
  }

  // Ensure lead belongs to this company
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: user.companyId },
  });
  if (!lead) {
    return c.json({ error: { message: "Lead not found", code: "NOT_FOUND" } }, 404);
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { status },
  });
  return c.json({ data: updated });
});

export { leadsRouter };
