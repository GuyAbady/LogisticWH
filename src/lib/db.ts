import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// מופע יחיד של Prisma (מונע ריבוי חיבורים בזמן פיתוח עם Hot Reload).
// ב-Vercel יש להשתמש ב-DATABASE_URL מסוג Pooled (Neon מספק אותו אוטומטית).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL אינו מוגדר");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
