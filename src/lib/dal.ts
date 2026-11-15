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

/** דורש משתמש מחובר עם אחד מהתפקידים; אחרת מפנה. ADMIN עובר כל בדיקת תפקיד (על-תפקיד). */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && user.role !== "ADMIN" && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/**
 * היחידה שבה פועל מנהל: מנהל יחידה – תמיד היחידה שלו (לא סומכים על פרמטר מהלקוח);
 * מנהל מערכת – יחידה שנבחרה (אם קיימת), אחרת היחידה שלו.
 */
export async function actingUnit(user: CurrentUser, requestedUnitId?: string | null) {
  if (user.role === "ADMIN" && requestedUnitId && requestedUnitId !== user.unitId) {
    const unit = await db.unit.findUnique({ where: { id: requestedUnitId }, select: { id: true, name: true } });
    if (unit) return unit;
  }
  return { id: user.unitId, name: user.unit.name };
}

/** שחקן לפעולות מנהל יחידה, עם יחידה פעילה (למנהל מערכת – לפי בחירה) */
export async function managerActor(user: CurrentUser, requestedUnitId?: string | null) {
  const unit = await actingUnit(user, requestedUnitId);
  return { ...user, unitId: unit.id };
}
