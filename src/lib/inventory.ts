import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import type { SerialStatus } from "@/generated/prisma/enums";

/*
 * לוגיקת מלאי. כל פעולה:
 *  1. רצה בתוך טרנזקציה אחת (db.$transaction),
 *  2. רושמת שורה ביומן התנועות (Transaction – Append-only),
 *  3. מעדכנת את מוני CatalogItem.
 * לפריט סידורי – המונים מחושבים מחדש מתוך טבלת הסידוריים (מקור אמת יחיד),
 * כך שאין סטייה מצטברת בין המונה לבין הפריטים בפועל.
 */

type Tx = Prisma.TransactionClient;

export class InventoryError extends Error {
  override name = "InventoryError"; // שם קבוע – constructor.name אינו אמין אחרי minify
}

/** חישוב מחדש של מוני פריט סידורי מתוך הסידוריים בפועל */
export async function recalcSerialCounters(tx: Tx, catalogItemId: string) {
  const [total, available] = await Promise.all([
    tx.inventorySerial.count({ where: { catalogItemId, status: { not: "WRITTEN_OFF" } } }),
    tx.inventorySerial.count({ where: { catalogItemId, status: "IN_STOCK" } }),
  ]);
  await tx.catalogItem.update({
    where: { id: catalogItemId },
    data: { totalQuantity: total, availableQty: available },
  });
}

/** קליטת מלאי כמותי */
export async function receiveQuantity(params: {
  catalogItemId: string;
  quantity: number;
  performedById: string;
  note?: string;
}) {
  const { catalogItemId, quantity, performedById, note } = params;
  if (!Number.isInteger(quantity) || quantity <= 0) throw new InventoryError("כמות חייבת להיות מספר שלם חיובי");
  return db.$transaction(async (tx) => {
    const item = await tx.catalogItem.findUnique({ where: { id: catalogItemId } });
    if (!item) throw new InventoryError("פריט לא נמצא");
    if (item.requiresSerial) throw new InventoryError("פריט סידורי נקלט לפי מספרים סידוריים");
    await tx.catalogItem.update({
      where: { id: catalogItemId },
      data: { totalQuantity: { increment: quantity }, availableQty: { increment: quantity } },
    });
    await tx.transaction.create({
      data: { type: "STOCK_IN", catalogItemId, quantity, performedById, note },
    });
  });
}

/** קליטת פריטים סידוריים (רשימת מספרים) */
export async function receiveSerials(params: {
  catalogItemId: string;
  serialNumbers: string[];
  performedById: string;
  note?: string;
}) {
  const { catalogItemId, performedById, note } = params;
  const serialNumbers = [...new Set(params.serialNumbers.map((s) => s.trim()).filter(Boolean))];
  if (serialNumbers.length === 0) throw new InventoryError("לא הוזנו מספרים סידוריים");
  if (serialNumbers.length > 500) throw new InventoryError("ניתן לקלוט עד 500 מספרים סידוריים בפעולה אחת");

  return db.$transaction(async (tx) => {
    const item = await tx.catalogItem.findUnique({ where: { id: catalogItemId } });
    if (!item) throw new InventoryError("פריט לא נמצא");
    if (!item.requiresSerial) throw new InventoryError("פריט כמותי נקלט לפי כמות");

    const existing = await tx.inventorySerial.findMany({
      where: { serialNumber: { in: serialNumbers } },
      select: { serialNumber: true },
    });
    if (existing.length) {
      throw new InventoryError(`מספרים סידוריים קיימים כבר במערכת: ${existing.map((e) => e.serialNumber).join(", ")}`);
    }

    for (const serialNumber of serialNumbers) {
      const s = await tx.inventorySerial.create({ data: { serialNumber, catalogItemId } });
      await tx.transaction.create({
        data: { type: "STOCK_IN", catalogItemId, serialId: s.id, quantity: 1, performedById, note },
      });
    }
    await recalcSerialCounters(tx, catalogItemId);
    return serialNumbers.length;
  });
}

/** מעברי סטטוס מותרים לפריט סידורי מתוך המחסן (ללא שיוך לעובד) */
const SERIAL_TRANSITIONS: Partial<Record<SerialStatus, { to: SerialStatus; type: "REPAIR_OUT" | "REPAIR_IN" | "WRITE_OFF" }[]>> = {
  IN_STOCK: [
    { to: "IN_REPAIR", type: "REPAIR_OUT" },
    { to: "WRITTEN_OFF", type: "WRITE_OFF" },
  ],
  IN_REPAIR: [
    { to: "IN_STOCK", type: "REPAIR_IN" },
    { to: "WRITTEN_OFF", type: "WRITE_OFF" },
  ],
};

export function allowedSerialTransitions(status: SerialStatus) {
  return SERIAL_TRANSITIONS[status] ?? [];
}

export async function changeSerialStatus(params: {
  serialId: string;
  to: SerialStatus;
  performedById: string;
  note?: string;
}) {
  const { serialId, to, performedById, note } = params;
  return db.$transaction(async (tx) => {
    const serial = await tx.inventorySerial.findUnique({ where: { id: serialId } });
    if (!serial) throw new InventoryError("מספר סידורי לא נמצא");
    const transition = allowedSerialTransitions(serial.status).find((t) => t.to === to);
    if (!transition) throw new InventoryError("מעבר סטטוס לא מותר מהמצב הנוכחי");
    if (serial.holderId) throw new InventoryError("לא ניתן לשנות סטטוס לפריט המשויך לעובד");

    // עדכון מותנה בסטטוס הנוכחי – מונע מרוץ בין שתי פעולות במקביל
    const updated = await tx.inventorySerial.updateMany({
      where: { id: serialId, status: serial.status },
      data: { status: to },
    });
    if (updated.count !== 1) throw new InventoryError("הפריט עודכן במקביל – רענן ונסה שוב");

    await tx.transaction.create({
      data: { type: transition.type, catalogItemId: serial.catalogItemId, serialId, quantity: 1, performedById, note },
    });
    await recalcSerialCounters(tx, serial.catalogItemId);
  });
}

/** תיקון מלאי כמותי (חיובי/שלילי) או גריעה – רק מהמלאי הזמין במחסן */
export async function adjustQuantity(params: {
  catalogItemId: string;
  delta: number;
  type: "ADJUST" | "WRITE_OFF";
  performedById: string;
  note: string;
}) {
  const { catalogItemId, delta, type, performedById, note } = params;
  if (!Number.isInteger(delta) || delta === 0) throw new InventoryError("יש להזין כמות שונה מאפס");
  if (type === "WRITE_OFF" && delta > 0) throw new InventoryError("גריעה חייבת להיות כמות שלילית");
  if (!note?.trim()) throw new InventoryError("חובה לציין סיבה לתיקון מלאי");

  return db.$transaction(async (tx) => {
    const item = await tx.catalogItem.findUnique({ where: { id: catalogItemId } });
    if (!item) throw new InventoryError("פריט לא נמצא");
    if (item.requiresSerial) throw new InventoryError("לפריט סידורי יש לשנות סטטוס לכל מספר סידורי");

    if (delta < 0) {
      // הפחתה מותנית – לא מאפשרת לרדת מתחת לאפס גם בבקשות מקבילות
      const res = await tx.catalogItem.updateMany({
        where: { id: catalogItemId, availableQty: { gte: -delta } },
        data: { totalQuantity: { decrement: -delta }, availableQty: { decrement: -delta } },
      });
      if (res.count !== 1) throw new InventoryError(`אין מספיק מלאי זמין במחסן (זמין: ${item.availableQty})`);
    } else {
      await tx.catalogItem.update({
        where: { id: catalogItemId },
        data: { totalQuantity: { increment: delta }, availableQty: { increment: delta } },
      });
    }
    await tx.transaction.create({
      data: { type, catalogItemId, quantity: Math.abs(delta), performedById, note: `${delta > 0 ? "+" : "-"}${Math.abs(delta)} · ${note}` },
    });
  });
}
