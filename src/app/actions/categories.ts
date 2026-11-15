"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { errorMessage, type ActionResult } from "@/lib/action-result";

// ניהול קטגוריות: מרלו"ג ומנהל מערכת (requireRole מעביר ADMIN אוטומטית)
const NameSchema = z.string().trim().min(2, "שם קטגוריה קצר מדי").max(40, "שם קטגוריה ארוך מדי");
const ICON_KEYS = ["package", "laptop", "tablet", "phone", "radio", "monitor", "headphones", "cable", "battery", "hardhat", "shirt", "hand", "wrench"] as const;

function revalidate() {
  revalidatePath("/warehouse", "layout");
  revalidatePath("/employee/requests");
}

export async function createCategory(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const name = NameSchema.safeParse(fd.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const icon = z.enum(ICON_KEYS).catch("package").parse(fd.get("icon"));
  try {
    const c = await db.category.create({ data: { name: name.data, icon } });
    await audit({ userId: user.id, action: "CATEGORY_CREATE", entity: "Category", entityId: c.id, details: c.name });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidate();
  return { ok: "הקטגוריה נוספה" };
}

/** שינוי שם ו/או אייקון. שינוי שם מתעדכן בכל הפריטים (FK עם ON UPDATE CASCADE) */
export async function updateCategory(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const id = String(fd.get("id") ?? "");
  const name = NameSchema.safeParse(fd.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const icon = z.enum(ICON_KEYS).catch("package").parse(fd.get("icon"));
  try {
    await db.category.update({ where: { id }, data: { name: name.data, icon } });
    await audit({ userId: user.id, action: "CATEGORY_UPDATE", entity: "Category", entityId: id, details: name.data });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidate();
  return { ok: "הקטגוריה עודכנה" };
}

export async function deleteCategory(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const id = String(fd.get("id") ?? "");
  const c = await db.category.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
  if (!c) return { error: "קטגוריה לא נמצאה" };
  if (c._count.items > 0) return { error: `לא ניתן למחוק – יש ${c._count.items} פריטים בקטגוריה. העבר אותם לקטגוריה אחרת תחילה.` };
  await db.category.delete({ where: { id } });
  await audit({ userId: user.id, action: "CATEGORY_DELETE", entity: "Category", entityId: id, details: c.name });
  revalidate();
  return { ok: "הקטגוריה נמחקה" };
}
