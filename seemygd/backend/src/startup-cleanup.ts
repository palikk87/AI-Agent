import { db } from "./prisma";

// Startup migration: Resend API key + From Email must be BLANK by default on
// every account until that account's owner enters their own info. Earlier a
// bulk copy pushed the super-admin's shared Resend credentials into every live
// account, so accounts show the super admin's key/email instead of a blank
// field.
//
// This clears ONLY the copied super-admin/shared values (a value the no account
// should legitimately have), so it is safe to run on every boot: values an
// account genuinely entered itself differ from these and are never touched.
// The super admin's own account (matched by email / isAdmin) is excluded.
export async function clearCopiedResendCredentials(): Promise<void> {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "brokenspringllc@gmail.com";
  const sharedResendKey = process.env.RESEND_API_KEY || "";

  try {
    // Company IDs belonging to the super admin — leave these untouched.
    const adminUsers = await db.user.findMany({
      where: { OR: [{ email: superAdminEmail }, { isAdmin: true }] },
      select: { companyId: true },
    });
    const adminCompanyIds = adminUsers
      .map((u) => u.companyId)
      .filter((id): id is string => Boolean(id));

    // Clear the shared Resend API key wherever it was copied in.
    const clearedKeys = await db.company.updateMany({
      where: {
        id: { notIn: adminCompanyIds },
        resendApiKey: sharedResendKey ? sharedResendKey : undefined,
      },
      data: { resendApiKey: null },
    });

    // Clear the super-admin From Email wherever it was copied in.
    const clearedEmails = await db.company.updateMany({
      where: {
        id: { notIn: adminCompanyIds },
        resendFromEmail: superAdminEmail,
      },
      data: { resendFromEmail: null },
    });

    if (clearedKeys.count || clearedEmails.count) {
      console.log(
        `[startup-cleanup] Cleared copied Resend credentials — keys: ${clearedKeys.count}, from-emails: ${clearedEmails.count}`
      );
    }
  } catch (err) {
    // Never block server startup on this maintenance task.
    console.error("[startup-cleanup] Failed to clear copied Resend credentials:", err);
  }
}
