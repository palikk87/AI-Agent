import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
const user = await db.user.findUnique({
  where: { email: "brokenspringllc@gmail.com" },
  include: { accounts: true }
})
console.log("User:", JSON.stringify({
  id: user?.id, email: user?.email, isAdmin: user?.isAdmin,
  accounts: user?.accounts?.map(a => ({
    providerId: a.providerId,
    hasPassword: !!a.password,
    passwordStart: a.password?.substring(0, 15)
  }))
}, null, 2))
await db.$disconnect()
