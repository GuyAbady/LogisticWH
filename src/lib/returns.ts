import "server-only";
import { db } from "./db";
import { recalcSerialCounters } from "./inventory";
import { canonicalGeneric, DOC_TERMS, sha256, type DocLine, type DocType, type GenericDoc } from "./receipt";
import type { Prisma } from "@/generated/prisma/client";
import type { Role, SignatureKind } from "@/generated/prisma/enums";

/*
 * זימוני החזרה וקליטת החזרות (זיכוי).
 * זימון: פריט סידורי עובר ל-PENDING_RETURN (נשאר רשום על העובד); כמותי – הזימון מתעד כמות.
 * קליטה: הציוד יורד מהעובד; תקין → למחסן, פגום → סידורי לתיקון / כמותי לגריעה.
 * כל קליטה = טופס זיכוי חתום אחד (SHA-256) שנשלח לעובד.
 */

export class ReturnError extends Error {
  override name = "ReturnError";
}

type Tx = Prisma.TransactionClient;
type Actor = { id: string; role: Role; unitId: string; fullName: string };

const ROLE_HE: Record<Role, string> = { EMPLOYEE: "עובד", UNIT_MANAGER: "מנהל יחידה", WAREHOUSE_MANAGER: 'מנהל מרלו"ג', ADMIN: "מנהל מערכת" };

/** יצירת רשומת חתימה למסמך כללי (משותף לזיכוי ולפעולות מרוכזות) */
export async function createSignedDoc(
  tx: Tx,
  p: {
    kind: SignatureKind;
    type: DocType;
    signer: Actor;
    unit: string | null;
    lines: DocLine[];
    reference: string | null;
    imageData: string;
    ipAddress: string | null;
    userAgent: string | null;
  },
) {
  const doc: GenericDoc = {
    type: p.type,
    version: 1,
    signedAt: new Date().toISOString(),
    signer: { id: p.signer.id, fullName: p.signer.fullName, role: ROLE_HE[p.signer.role] },
    unit: p.unit,
    lines: p.lines,
    reference: p.reference,
    terms: DOC_TERMS[p.type],
  };
  const documentJson = canonicalGeneric(doc);
  const sig = await tx.signature.create({
    data: {
      kind: p.kind,
      signerId: p.signer.id,
      imageData: p.imageData,
      documentJson,
      documentHash: sha256(documentJson),
      ipAddress: p.ipAddress,
      userAgent: p.userAgent?.slice(0, 400) ?? null,
      signedAt: new Date(doc.signedAt),
    },
  });
  return { sig, doc };
}

// ───────── זימונים ─────────

export async function createSummons(
  actor: Actor,
  input: { userId: string; serialId?: string; catalogItemId?: string; quantity?: number; reason: string; dueDate: Date | null },
) {
  if (!input.reason.trim()) throw new ReturnError("יש לציין סיבת זימון");
  return db.$transaction(async (tx) => {
    if (input.serialId) {
      const s = await tx.inventorySerial.findUnique({ where: { id: input.serialId } });
      if (!s || s.holderId !== input.userId) throw new ReturnError("הפריט אינו רשום על העובד");
      const res = await tx.inventorySerial.updateMany({ where: { id: s.id, status: "SIGNED", holderId: input.userId }, data: { status: "PENDING_RETURN" } });
      if (res.count !== 1) throw new ReturnError("ניתן לזמן רק פריט חתום (לא כזה שכבר זומן או ממתין לאישור)");
      return tx.returnSummons.create({
        data: { userId: input.userId, catalogItemId: s.catalogItemId, serialId: s.id, quantity: 1, reason: input.reason.trim(), dueDate: input.dueDate, createdById: actor.id },
      });
    }
    const quantity = input.quantity ?? 0;
    if (!input.catalogItemId || !Number.isInteger(quantity) || quantity < 1) throw new ReturnError("יש לבחור פריט וכמות");
    const holding = await tx.quantityHolding.findUnique({ where: { catalogItemId_userId: { catalogItemId: input.catalogItemId, userId: input.userId } } });
    const open = await tx.returnSummons.aggregate({
      where: { userId: input.userId, catalogItemId: input.catalogItemId, serialId: null, status: "PENDING_RETURN" },
      _sum: { quantity: true },
    });
    const available = (holding?.quantity ?? 0) - (open._sum.quantity ?? 0);
    if (quantity > available) throw new ReturnError(`ניתן לזמן עד ${Math.max(available, 0)} יחידות (כולל זימונים פתוחים)`);
    return tx.returnSummons.create({
      data: { userId: input.userId, catalogItemId: input.catalogItemId, quantity, reason: input.reason.trim(), dueDate: input.dueDate, createdById: actor.id },
    });
  });
}

export async function cancelSummons(summonsId: string) {
  await db.$transaction(async (tx) => {
    const res = await tx.returnSummons.updateMany({ where: { id: summonsId, status: "PENDING_RETURN" }, data: { status: "CANCELLED", closedAt: new Date() } });
    if (res.count !== 1) throw new ReturnError("הזימון כבר נסגר");
    const s = await tx.returnSummons.findUniqueOrThrow({ where: { id: summonsId } });
    if (s.serialId) {
      await tx.inventorySerial.updateMany({ where: { id: s.serialId, status: "PENDING_RETURN" }, data: { status: "SIGNED" } });
    }
  });
}

// ───────── קליטת החזרה ─────────

export type ReturnItem =
  | { kind: "serial"; serialId: string; damaged: boolean }
  | { kind: "qty"; catalogItemId: string; quantity: number; damaged: boolean };

export async function receiveReturn(
  actor: Actor,
  input: { userId: string; items: ReturnItem[]; imageData: string; ipAddress: string | null; userAgent: string | null },
) {
  if (input.items.length === 0) throw new ReturnError("לא נבחרו פריטים להחזרה");
  return db.$transaction(async (tx) => {
    const emp = await tx.user.findUnique({ where: { id: input.userId }, include: { unit: true } });
    if (!emp) throw new ReturnError("עובד לא נמצא");

    const lines: DocLine[] = [];
    const touchedSerialItems = new Set<string>();
    const pending: { type: "serial" | "qty"; catalogItemId: string; serialId?: string; quantity: number; damaged: boolean }[] = [];

    for (const it of input.items) {
      if (it.kind === "serial") {
        const s = await tx.inventorySerial.findUnique({ where: { id: it.serialId }, include: { catalogItem: true } });
        if (!s || s.holderId !== emp.id) throw new ReturnError("פריט סידורי אינו רשום על העובד");
        // לא מקבלים פריט שעדיין ממתין לאישור העובד (העברה ממנהל יחידה)
        const res = await tx.inventorySerial.updateMany({
          where: { id: s.id, holderId: emp.id, status: { in: ["SIGNED", "PENDING_RETURN"] } },
          data: { holderId: null, allocatedRequestId: null, status: it.damaged ? "IN_REPAIR" : "IN_STOCK" },
        });
        if (res.count !== 1) throw new ReturnError(`לא ניתן לקלוט את ${s.serialNumber} במצבו הנוכחי`);
        touchedSerialItems.add(s.catalogItemId);
        pending.push({ type: "serial", catalogItemId: s.catalogItemId, serialId: s.id, quantity: 1, damaged: it.damaged });
        lines.push({
          employeeId: emp.id, employeeName: emp.fullName, employeeNumber: emp.employeeNumber,
          sku: s.catalogItem.sku, name: s.catalogItem.name, serialNumber: s.serialNumber, quantity: 1,
          condition: it.damaged ? "פגום – הועבר לתיקון" : "תקין",
        });
      } else {
        if (!Number.isInteger(it.quantity) || it.quantity < 1) throw new ReturnError("כמות לא תקינה");
        const item = await tx.catalogItem.findUniqueOrThrow({ where: { id: it.catalogItemId } });
        const res = await tx.quantityHolding.updateMany({
          where: { catalogItemId: it.catalogItemId, userId: emp.id, quantity: { gte: it.quantity } },
          data: { quantity: { decrement: it.quantity } },
        });
        if (res.count !== 1) throw new ReturnError(`לעובד אין ${it.quantity} יחידות של ${item.name}`);
        await tx.catalogItem.update({
          where: { id: it.catalogItemId },
          // תקין – חוזר למלאי הזמין; פגום – יוצא מהמלאי (גריעה)
          data: it.damaged ? { totalQuantity: { decrement: it.quantity } } : { availableQty: { increment: it.quantity } },
        });
        pending.push({ type: "qty", catalogItemId: it.catalogItemId, quantity: it.quantity, damaged: it.damaged });
        lines.push({
          employeeId: emp.id, employeeName: emp.fullName, employeeNumber: emp.employeeNumber,
          sku: item.sku, name: item.name, serialNumber: null, quantity: it.quantity,
          condition: it.damaged ? "פגום – נגרע" : "תקין",
        });
      }
    }

    const { sig, doc } = await createSignedDoc(tx, {
      kind: "RETURN", type: "RETURN", signer: actor, unit: emp.unit.name, lines, reference: null,
      imageData: input.imageData, ipAddress: input.ipAddress, userAgent: input.userAgent,
    });

    for (const p of pending) {
      await tx.transaction.create({
        data: {
          type: "RETURN", catalogItemId: p.catalogItemId, serialId: p.serialId ?? null, quantity: p.quantity,
          fromUserId: emp.id, performedById: actor.id, signatureId: sig.id, note: p.damaged ? "הוחזר פגום" : null,
        },
      });
      if (p.damaged) {
        await tx.transaction.create({
          data: {
            type: p.type === "serial" ? "REPAIR_OUT" : "WRITE_OFF", catalogItemId: p.catalogItemId, serialId: p.serialId ?? null,
            quantity: p.quantity, performedById: actor.id, note: "בעקבות החזרה במצב פגום",
          },
        });
      }
    }
    for (const id of touchedSerialItems) await recalcSerialCounters(tx, id);

    // סגירת זימונים פתוחים שהחזרה זו מכסה
    for (const p of pending) {
      if (p.type === "serial") {
        await tx.returnSummons.updateMany({
          where: { userId: emp.id, serialId: p.serialId, status: "PENDING_RETURN" },
          data: { status: "RETURNED_CREDITED", closedAt: new Date(), returnSignatureId: sig.id },
        });
      } else {
        // זימונים כמותיים נסגרים לפי סדר יצירה, כל עוד הכמות שהוחזרה מכסה אותם
        let left = p.quantity;
        const open = await tx.returnSummons.findMany({
          where: { userId: emp.id, catalogItemId: p.catalogItemId, serialId: null, status: "PENDING_RETURN" },
          orderBy: { createdAt: "asc" },
        });
        for (const s of open) {
          if (s.quantity > left) break;
          left -= s.quantity;
          await tx.returnSummons.update({ where: { id: s.id }, data: { status: "RETURNED_CREDITED", closedAt: new Date(), returnSignatureId: sig.id } });
        }
      }
    }
    return { signatureId: sig.id, doc, employee: emp };
  });
}
