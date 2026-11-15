"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { errorMessage, type ActionResult } from "@/lib/action-result";
import { adjustQuantity, changeSerialStatus, receiveQuantity, receiveSerials } from "@/lib/inventory";

const CatalogSchema = z.object({
  sku: z.string().trim().min(2, 'מק"ט קצר מדי').max(40).regex(/^[A-Za-z0-9._-]+$/, 'מק"ט: אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון'),
  name: z.string().trim().min(2, "שם פריט קצר מדי").max(120),
  category: z.string().trim().min(2, "יש לבחור / להזין קטגוריה").max(60),
  description: z.string().trim().max(500).optional(),
  requiresSerial: z.boolean(),
});

export async function createCatalogItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const parsed = CatalogSchema.safeParse({
    sku: fd.get("sku"),
    name: fd.get("name"),
    category: fd.get("category"),
    description: (fd.get("description") as string) || undefined,
    requiresSerial: fd.get("requiresSerial") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await db.category.findUnique({ where: { name: parsed.data.category } }))) return { error: "יש לבחור קטגוריה קיימת" };
  let id: string;
  try {
    const item = await db.catalogItem.create({ data: { ...parsed.data, sku: parsed.data.sku.toUpperCase() } });
    id = item.id;
    await audit({ userId: user.id, action: "CATALOG_CREATE", entity: "CatalogItem", entityId: id, details: item.sku });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/warehouse/inventory");
  redirect(`/warehouse/inventory/${id}`);
}

export async function receiveStock(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const catalogItemId = String(fd.get("catalogItemId") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || undefined;
  try {
    const item = await db.catalogItem.findUnique({ where: { id: catalogItemId }, select: { requiresSerial: true } });
    if (!item) return { error: "פריט לא נמצא" };
    let msg: string;
    if (item.requiresSerial) {
      // מספרים מופרדים בשורה חדשה, פסיק או רווח
      const serials = String(fd.get("serials") ?? "").split(/[\s,;]+/);
      const n = await receiveSerials({ catalogItemId, serialNumbers: serials, performedById: user.id, note });
      msg = `נקלטו ${n} פריטים סידוריים`;
    } else {
      const quantity = Number(fd.get("quantity"));
      await receiveQuantity({ catalogItemId, quantity, performedById: user.id, note });
      msg = `נקלטו ${quantity} יחידות`;
    }
    await audit({ userId: user.id, action: "STOCK_IN", entity: "CatalogItem", entityId: catalogItemId, details: msg });
    revalidatePath(`/warehouse/inventory/${catalogItemId}`);
    revalidatePath("/warehouse/inventory");
    return { ok: msg };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function setSerialStatus(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const serialId = String(fd.get("serialId") ?? "");
  const to = z.enum(["IN_STOCK", "IN_REPAIR", "WRITTEN_OFF"]).safeParse(fd.get("to"));
  if (!to.success) return { error: "סטטוס לא תקין" };
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || undefined;
  if (to.data === "WRITTEN_OFF" && !note) return { error: "חובה לציין סיבת גריעה" };
  try {
    await changeSerialStatus({ serialId, to: to.data, performedById: user.id, note });
    await audit({ userId: user.id, action: "SERIAL_STATUS", entity: "InventorySerial", entityId: serialId, details: to.data });
    revalidatePath("/warehouse/inventory", "layout");
    return { ok: "הסטטוס עודכן" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function adjustStock(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const catalogItemId = String(fd.get("catalogItemId") ?? "");
  const delta = Number(fd.get("delta"));
  const type = fd.get("type") === "WRITE_OFF" ? "WRITE_OFF" : "ADJUST";
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);
  try {
    await adjustQuantity({ catalogItemId, delta, type, performedById: user.id, note });
    await audit({ userId: user.id, action: "STOCK_ADJUST", entity: "CatalogItem", entityId: catalogItemId, details: `${type} ${delta}` });
    revalidatePath(`/warehouse/inventory/${catalogItemId}`);
    return { ok: "המלאי עודכן" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const UpdateItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "שם פריט קצר מדי").max(120),
  category: z.string().trim().min(1, "יש לבחור קטגוריה"),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
});

/** עריכת פרטי פריט קטלוג (לא מק"ט ולא סוג סידורי/כמותי – משפיעים על נתונים קיימים) */
export async function updateCatalogItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole("WAREHOUSE_MANAGER");
  const parsed = UpdateItemSchema.safeParse({
    id: fd.get("id"),
    name: fd.get("name"),
    category: fd.get("category"),
    description: (fd.get("description") as string) || undefined,
    isActive: fd.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...data } = parsed.data;
  if (!(await db.category.findUnique({ where: { name: data.category } }))) return { error: "יש לבחור קטגוריה קיימת" };
  try {
    await db.catalogItem.update({ where: { id }, data: { ...data, description: data.description ?? null } });
    await audit({ userId: user.id, action: "CATALOG_UPDATE", entity: "CatalogItem", entityId: id });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/warehouse", "layout");
  return { ok: "הפריט עודכן" };
}
