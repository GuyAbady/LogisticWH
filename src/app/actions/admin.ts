"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/session";
import { PasswordSchema } from "@/lib/password";
import { errorMessage, type ActionResult } from "@/lib/action-result";

const UnitSchema = z.object({
  name: z.string().trim().min(2, "שם יחידה קצר מדי").max(80),
  code: z.string().trim().min(1, "יש להזין קוד").max(20).regex(/^[A-Za-z0-9_-]+$/, "קוד: אותיות באנגלית, ספרות, - או _"),
});

/** מנהל מרלו"ג אינו רשאי לשנות משתמש ADMIN (השבתה/איפוס סיסמה) */
async function isAdminTargetForbidden(actorRole: string, targetId: string) {
  if (actorRole === "ADMIN") return false;
  const t = await db.user.findUnique({ where: { id: targetId }, select: { role: true } });
  return t?.role === "ADMIN";
}

export async function createUnit(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const parsed = UnitSchema.safeParse({ name: fd.get("name"), code: fd.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const unit = await db.unit.create({ data: { name: parsed.data.name, code: parsed.data.code.toUpperCase() } });
    await audit({ userId: user.id, action: "UNIT_CREATE", entity: "Unit", entityId: unit.id, details: unit.name });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/warehouse/users");
  return { ok: "היחידה נוספה" };
}

const UserSchema = z.object({
  fullName: z.string().trim().min(2, "שם מלא קצר מדי").max(80),
  employeeNumber: z.string().trim().min(1, "יש להזין מספר עובד").max(20),
  email: z.string().trim().toLowerCase().email('כתובת דוא"ל לא תקינה'),
  phone: z.string().trim().regex(/^[0-9+\-\s]{9,15}$/, "מספר טלפון לא תקין"),
  role: z.enum(["EMPLOYEE", "UNIT_MANAGER", "WAREHOUSE_MANAGER", "ADMIN"]),
  unitId: z.string().uuid("יש לבחור יחידה"),
  password: PasswordSchema,
});

export async function createUser(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireRole("WAREHOUSE_MANAGER");
  const parsed = UserSchema.safeParse(Object.fromEntries(
    ["fullName", "employeeNumber", "email", "phone", "role", "unitId", "password"].map((k) => [k, fd.get(k)]),
  ));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, ...data } = parsed.data;
  // מניעת הסלמת הרשאות: רק מנהל מערכת מעניק תפקיד ADMIN.
  // חריג אתחול: כשאין אף מנהל מערכת, מנהל מרלו"ג רשאי ליצור את הראשון (נרשם ביומן).
  if (data.role === "ADMIN" && admin.role !== "ADMIN") {
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    if (admins > 0) return { error: "רק מנהל מערכת יכול ליצור מנהל מערכת" };
  }
  // כפילות: הודעה ברורה שמפנה לעריכה (במקום שגיאת "ערך כפול" כללית)
  const existing = await db.user.findFirst({
    where: { OR: [{ employeeNumber: data.employeeNumber }, { email: data.email }] },
    select: { fullName: true, employeeNumber: true, email: true },
  });
  if (existing) {
    const what = existing.employeeNumber === data.employeeNumber ? `מספר עובד ${data.employeeNumber}` : `דוא"ל ${data.email}`;
    return { error: `כבר קיים משתמש עם ${what} (${existing.fullName}). כדי לשנות את פרטיו או את תפקידו – פתחו "עריכה" בכרטיס שלו ברשימת המשתמשים, או "עריכת החשבון שלי" בראש הדף.` };
  }
  try {
    const u = await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) } });
    await audit({ userId: admin.id, action: "USER_CREATE", entity: "User", entityId: u.id, details: data.role });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/warehouse/users");
  return { ok: `המשתמש ${data.fullName} נוצר. מסור לו את הסיסמה הזמנית ובקש לשנותה בכניסה הראשונה.` };
}

export async function setUserActive(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireRole("WAREHOUSE_MANAGER");
  const userId = String(fd.get("userId") ?? "");
  const active = fd.get("active") === "true";
  if (userId === admin.id) return { error: "לא ניתן להשבית את המשתמש שלך" };
  if (await isAdminTargetForbidden(admin.role, userId)) return { error: "רק מנהל מערכת יכול לשנות מנהל מערכת" };
  if (!active) {
    // לא משביתים עובד שעדיין מחזיק ציוד – קודם יש לזכות
    const [serials, qty] = await Promise.all([
      db.inventorySerial.count({ where: { holderId: userId } }),
      db.quantityHolding.aggregate({ where: { userId }, _sum: { quantity: true } }),
    ]);
    if (serials > 0 || (qty._sum.quantity ?? 0) > 0) {
      return { error: "לא ניתן להשבית עובד שרשום עליו ציוד. יש לזכות את הציוד תחילה." };
    }
  }
  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  await audit({ userId: admin.id, action: active ? "USER_ACTIVATE" : "USER_DEACTIVATE", entity: "User", entityId: userId });
  revalidatePath("/warehouse/users");
  return { ok: active ? "המשתמש הופעל" : "המשתמש הושבת" };
}

export async function resetUserPassword(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireRole("WAREHOUSE_MANAGER");
  const userId = String(fd.get("userId") ?? "");
  const parsed = PasswordSchema.safeParse(fd.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await isAdminTargetForbidden(admin.role, userId)) return { error: "רק מנהל מערכת יכול לשנות מנהל מערכת" };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(parsed.data, 12) } });
  await audit({ userId: admin.id, action: "USER_PASSWORD_RESET", entity: "User", entityId: userId });
  return { ok: "הסיסמה אופסה. מסור אותה לעובד בערוץ מאובטח." };
}

const EditUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2, "שם מלא קצר מדי").max(80),
  employeeNumber: z.string().trim().min(1, "יש להזין מספר עובד").max(20),
  email: z.string().trim().toLowerCase().email('כתובת דוא"ל לא תקינה'),
  phone: z.string().trim().regex(/^[0-9+\-\s]{9,15}$/, "מספר טלפון לא תקין"),
  role: z.enum(["EMPLOYEE", "UNIT_MANAGER", "WAREHOUSE_MANAGER", "ADMIN"]),
  unitId: z.string().uuid("יש לבחור יחידה"),
});

/**
 * עריכת משתמש קיים (כולל שינוי תפקיד). כללי הרשאה:
 * - הענקת ADMIN: רק ADMIN, או כשאין עדיין אף ADMIN (אתחול – כולל קידום עצמי של מנהל מרלו"ג).
 * - מנהל מרלו"ג אינו עורך משתמש ADMIN.
 * - אסור להוריד את מנהל המערכת האחרון מתפקידו (מניעת נעילה מחוץ למערכת).
 */
export async function updateUser(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await requireRole("WAREHOUSE_MANAGER");
  const parsed = EditUserSchema.safeParse(Object.fromEntries(
    ["userId", "fullName", "employeeNumber", "email", "phone", "role", "unitId"].map((k) => [k, fd.get(k)]),
  ));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, ...data } = parsed.data;

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { error: "משתמש לא נמצא" };
  if (await isAdminTargetForbidden(actor.role, userId)) return { error: "רק מנהל מערכת יכול לערוך מנהל מערכת" };

  const admins = await db.user.count({ where: { role: "ADMIN", isActive: true } });
  if (data.role === "ADMIN" && target.role !== "ADMIN" && actor.role !== "ADMIN" && admins > 0) {
    return { error: "רק מנהל מערכת יכול להעניק תפקיד מנהל מערכת" };
  }
  if (target.role === "ADMIN" && data.role !== "ADMIN" && admins <= 1) {
    return { error: "זהו מנהל המערכת היחיד – לא ניתן להסיר את תפקידו" };
  }

  try {
    await db.user.update({ where: { id: userId }, data });
    await audit({
      userId: actor.id, action: "USER_UPDATE", entity: "User", entityId: userId,
      details: target.role !== data.role ? `תפקיד: ${target.role} → ${data.role}` : undefined,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  // עריכה עצמית: רענון עוגיית ה-Session, כדי שהניתוב (proxy) יכיר מיד בתפקיד/יחידה החדשים
  if (userId === actor.id) await createSession({ userId, role: data.role, unitId: data.unitId });
  revalidatePath("/", "layout");
  return { ok: userId === actor.id && target.role !== data.role ? "התפקיד שלך עודכן. רעננו את הדף כדי לראות את התפריט החדש." : "המשתמש עודכן" };
}
