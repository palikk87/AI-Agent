import { PrismaClient } from "@prisma/client";

// Postgres (Supabase). Connection tuning lives in the DATABASE_URL itself —
// Supabase's pooled connection string (port 6543) already applies pgbouncer
// transaction pooling, so no per-connection setup is needed here.
//
// (Previously this file issued SQLite PRAGMAs — WAL, foreign_keys, busy_timeout,
// synchronous. Those are SQLite-only statements and would error on Postgres;
// Postgres enforces foreign keys and durability by default.)
const prisma = new PrismaClient();

export { prisma };

// Alias used by auth and newer route modules
export const db = prisma;
