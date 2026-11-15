"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { PasswordSchema } from "@/lib/password";
import { errorMessage, type ActionResult } from "@/lib/action-result";

const UnitSchema = z.object({
  name: z.string().trim().min(2, "שם יחידה קצר מדי").max(80),
  code: z.string().trim().min(1, "יש להזין קוד").max(20).regex(/^[A-Za-z0-9_-]+$/, "קוד: אותיות באנגלית, ספרות, - או _"),
});

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
  role: z.enum(["EMPLOYEE", "UNIT_MANAGER", "WAREHOUSE_MANAGER"]),
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
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(parsed.data, 12) } });
  await audit({ userId: admin.id, action: "USER_PASSWORD_RESET", entity: "User", entityId: userId });
  return { ok: "הסיסמה אופסה. מסור אותה לעובד בערוץ מאובטח." };
}
