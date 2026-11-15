import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";
import { ROLE_HOME } from "./roles";
import type { Role } from "@/generated/prisma/enums";

// שכבת גישה לנתונים (DAL): כל בדיקת הרשאה אמיתית נעשית כאן מול בסיס הנתונים,
// ולא רק ב-proxy (שם הבדיקה "אופטימית" בלבד, לפי המלצת תיעוד Next.js).
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      employeeNumber: true,
      role: true,
      isActive: true,
      unitId: true,
      unit: { select: { id: true, name: true } },
    },
  });
  if (!user || !user.isActive) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** דורש משתמש מחובר עם אחד מהתפקידים; אחרת מפנה. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
