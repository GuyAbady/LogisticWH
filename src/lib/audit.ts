import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

export async function getClientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function audit(params: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await db.auditLog.create({ data: { ...params, ipAddress: await getClientIp() } });
  } catch (e) {
    // כשל ברישום לוג לא יפיל את הפעולה העיקרית
    console.error("audit failed", e);
  }
}
