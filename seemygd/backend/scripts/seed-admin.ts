/**
 * seed-admin.ts — creates the super admin user (brokenspringllc@gmail.com)
 * Uses Better Auth's own hashPassword function for compatibility.
 * Usage: bun scripts/seed-admin.ts
 */
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "better-auth/crypto"

const db = new PrismaClient()
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "brokenspringllc@gmail.com"
const SUPER_ADMIN_PASSWORD = "Highsc60!"
const SUPER_ADMIN_NAME = "Super Admin"

function randomId(len = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (let i = 0; i < len; i++) id += chars[(bytes[i] ?? 0) % chars.length]
  return id
}

async function main() {
  console.log("Seeding super admin:", SUPER_ADMIN_EMAIL)

  const existing = await db.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    include: { accounts: true }
  })

  const hash = await hashPassword(SUPER_ADMIN_PASSWORD)

  if (existing) {
    if (!existing.isAdmin) {
      await db.user.update({ where: { id: existing.id }, data: { isAdmin: true } })
    }
    const credAccount = existing.accounts.find(a => a.providerId === "credential")
    if (credAccount) {
      await db.account.update({ where: { id: credAccount.id }, data: { password: hash } })
      console.log("✅ Password updated using Better Auth hash format")
    } else {
      await db.account.create({
        data: { id: randomId(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash }
      })
      console.log("✅ Credential account created")
    }
    console.log("✅ Super admin configured:", SUPER_ADMIN_EMAIL)
    await db.$disconnect()
    return
  }

  const userId = randomId()
  await db.user.create({
    data: { id: userId, name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL, emailVerified: true, isAdmin: true, role: "admin" },
  })
  await db.account.create({
    data: { id: randomId(), accountId: userId, providerId: "credential", userId, password: hash },
  })
  console.log("✅ Super admin created:", SUPER_ADMIN_EMAIL, "/ Highsc60!")
  await db.$disconnect()
}

main().catch(err => { console.error("❌ Failed:", err); process.exit(1) })
