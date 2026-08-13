import { PrismaClient } from "@prisma/client";

// (schema updated: Company.notificationEmail added)
const prisma = new PrismaClient();

async function initPragmas() {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
}
initPragmas();

export { prisma };

// Alias used by auth and newer route modules
export const db = prisma;
