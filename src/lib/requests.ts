import "server-only";
import { db } from "./db";
import { recalcSerialCounters } from "./inventory";
import { canonicalJson, RECEIPT_TERMS, sha256, type ReceiptDoc } from "./receipt";
import type { Role } from "@/generated/prisma/enums";

/*
 * זרימת בקשת ציוד:
 *   עובד מגיש → PENDING_MANAGER → מנהל יחידה מאשר → PENDING_WAREHOUSE
 *   → מרלו"ג מקצה (סידוריים / שריון כמות) + מועד איסוף → ALLOCATED
 *   → העובד חותם → FULFILLED (ציוד נרשם עליו + קבלה).
 * כל מעבר מותנה בסטטוס הנוכחי (updateMany עם where status) – מונע מרוץ בין פעולות מקבילות.
 */

export class RequestError extends Error {
  override name = "RequestError";
}

type Actor = { id: string; role: Role; unitId: string; fullName: string };

/** מעבר סטטוס מותנה; זורק אם הבקשה כבר אינה בסטטוס הצפוי */
async function transition(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  id: string,
  from: string,
  data: Record<string, unknown>,
) {
  const res = await tx.equipmentRequest.updateMany({ where: { id, status: from as never }, data });
  if (res.count !== 1) throw new RequestError("הבקשה עודכנה בינתיים או אינה בשלב המתאים – רענן את הדף");
}

export async function createRequest(actor: Actor, input: { catalogItemId: string; quantity: number; justification?: string }) {
  const item = await db.catalogItem.findUnique({ where: { id: input.catalogItemId } });
  if (!item || !item.isActive) throw new RequestError("פריט לא קיים");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) throw new RequestError("כמות חייבת להיות בין 1 ל-100");
  // בקשה של מנהל יחידה אינה דורשת אישור עצמי – עוברת ישר למרלו"ג
  const byManager = actor.role === "UNIT_MANAGER";
  return db.equipmentRequest.create({
    data: {
      requesterId: actor.id,
      unitId: actor.unitId,
      catalogItemId: item.id,
      quantity: input.quantity,
      justification: input.justification,
      status: byManager ? "PENDING_WAREHOUSE" : "PENDING_MANAGER",
      ...(byManager ? { managerId: actor.id, managerDecidedAt: new Date(), managerNote: "בקשת מנהל היחידה" } : {}),
    },
  });
}

export async function cancelRequest(actor: Actor, requestId: string) {
  const r = await db.equipmentRequest.findUnique({ where: { id: requestId } });
  if (!r || r.requesterId !== actor.id) throw new RequestError("בקשה לא נמצאה");
  if (!["PENDING_MANAGER", "PENDING_WAREHOUSE"].includes(r.status)) throw new RequestError("ניתן לבטל רק בקשה שטרם הוקצתה");
  await db.$transaction((tx) => transition(tx, requestId, r.status, { status: "CANCELLED" }));
}

export async function managerDecision(actor: Actor, requestId: string, approve: boolean, note?: string) {
  const r = await db.equipmentRequest.findUnique({ where: { id: requestId } });
  // מנהל יחידה מחליט רק על בקשות היחידה שלו
  if (!r || r.unitId !== actor.unitId) throw new RequestError("בקשה לא נמצאה");
  if (!approve && !note?.trim()) throw new RequestError("יש לציין סיבת דחייה");
  await db.$transaction((tx) =>
    transition(tx, requestId, "PENDING_MANAGER", {
      status: approve ? "PENDING_WAREHOUSE" : "REJECTED_MANAGER",
      managerId: actor.id,
      managerNote: note?.trim() || null,
      managerDecidedAt: new Date(),
    }),
  );
}

export async function warehouseReject(actor: Actor, requestId: string, note: string) {
  if (!note.trim()) throw new RequestError("יש לציין סיבת דחייה");
  await db.$transaction((tx) => transition(tx, requestId, "PENDING_WAREHOUSE", { status: "REJECTED_WAREHOUSE", warehouseNote: note.trim() }));
}

/** הקצאה: פריט סידורי – בחירת מספרים סידוריים מהמחסן; פריט כמותי – שריון הכמות מהמלאי הזמין */
export async function allocateRequest(actor: Actor, input: { requestId: string; serialIds: string[]; pickupDate: Date; note?: string }) {
  if (input.pickupDate.getTime() < Date.now() - 60 * 60 * 1000) throw new RequestError("מועד האיסוף כבר עבר");
  return db.$transaction(async (tx) => {
    const r = await tx.equipmentRequest.findUnique({ where: { id: input.requestId }, include: { catalogItem: true } });
    if (!r) throw new RequestError("בקשה לא נמצאה");
    await transition(tx, r.id, "PENDING_WAREHOUSE", {
      status: "ALLOCATED",
      pickupDate: input.pickupDate,
      warehouseNote: input.note?.trim() || null,
    });

    if (r.catalogItem.requiresSerial) {
      const ids = [...new Set(input.serialIds)];
      if (ids.length !== r.quantity) throw new RequestError(`יש לבחור בדיוק ${r.quantity} מספרים סידוריים`);
      // רק סידוריים של אותו פריט שנמצאים במחסן; העדכון מותנה בסטטוס – מונע הקצאה כפולה במקביל
      const res = await tx.inventorySerial.updateMany({
        where: { id: { in: ids }, catalogItemId: r.catalogItemId, status: "IN_STOCK", holderId: null },
        data: { status: "ALLOCATED", allocatedRequestId: r.id },
      });
      if (res.count !== ids.length) throw new RequestError("חלק מהמספרים הסידוריים אינם זמינים עוד במחסן – רענן ובחר שוב");
      for (const serialId of ids) {
        await tx.transaction.create({
          data: { type: "ALLOCATE", catalogItemId: r.catalogItemId, serialId, quantity: 1, toUserId: r.requesterId, performedById: actor.id, requestId: r.id },
        });
      }
      await recalcSerialCounters(tx, r.catalogItemId);
    } else {
      const res = await tx.catalogItem.updateMany({
        where: { id: r.catalogItemId, availableQty: { gte: r.quantity } },
        data: { availableQty: { decrement: r.quantity } },
      });
      if (res.count !== 1) throw new RequestError(`אין מספיק מלאי זמין (נדרש ${r.quantity}, זמין ${r.catalogItem.availableQty})`);
      await tx.transaction.create({
        data: { type: "ALLOCATE", catalogItemId: r.catalogItemId, quantity: r.quantity, toUserId: r.requesterId, performedById: actor.id, requestId: r.id },
      });
    }
    return r;
  });
}

/** שחרור הקצאה – הבקשה חוזרת לתור המרלו"ג והציוד חוזר למלאי הזמין */
export async function releaseAllocation(actor: Actor, requestId: string, note?: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.equipmentRequest.findUnique({ where: { id: requestId }, include: { catalogItem: true, allocatedSerials: true } });
    if (!r) throw new RequestError("בקשה לא נמצאה");
    await transition(tx, r.id, "ALLOCATED", { status: "PENDING_WAREHOUSE", pickupDate: null });
    if (r.catalogItem.requiresSerial) {
      const serials = r.allocatedSerials.filter((s) => s.status === "ALLOCATED");
      await tx.inventorySerial.updateMany({
        where: { id: { in: serials.map((s) => s.id) }, status: "ALLOCATED" },
        data: { status: "IN_STOCK", allocatedRequestId: null },
      });
      for (const s of serials) {
        await tx.transaction.create({
          data: { type: "DEALLOCATE", catalogItemId: r.catalogItemId, serialId: s.id, quantity: 1, performedById: actor.id, requestId: r.id, note },
        });
      }
      await recalcSerialCounters(tx, r.catalogItemId);
    } else {
      await tx.catalogItem.update({ where: { id: r.catalogItemId }, data: { availableQty: { increment: r.quantity } } });
      await tx.transaction.create({
        data: { type: "DEALLOCATE", catalogItemId: r.catalogItemId, quantity: r.quantity, performedById: actor.id, requestId: r.id, note },
      });
    }
  });
}

/** חתימת העובד על קבלת הציוד – רושם את הציוד על שמו ומפיק קבלה חתומה */
export async function signReceipt(
  actor: Actor,
  input: { requestId: string; imageData: string; ipAddress: string | null; userAgent: string | null },
) {
  return db.$transaction(async (tx) => {
    const r = await tx.equipmentRequest.findUnique({
      where: { id: input.requestId },
      include: {
        catalogItem: true,
        allocatedSerials: { where: { status: "ALLOCATED" }, orderBy: { serialNumber: "asc" } },
        requester: { include: { unit: true } },
        transactions: { where: { type: "ALLOCATE" }, include: { performedBy: { select: { fullName: true } } }, take: 1 },
      },
    });
    // רק מבקש הציוד עצמו חותם – לא ניתן לחתום בשם אחר
    if (!r || r.requesterId !== actor.id) throw new RequestError("בקשה לא נמצאה");
    if (r.status !== "ALLOCATED") throw new RequestError("הבקשה אינה ממתינה לחתימה");
    if (r.catalogItem.requiresSerial && r.allocatedSerials.length !== r.quantity) {
      throw new RequestError('הקצאת המספרים הסידוריים אינה שלמה – פנה למרלו"ג');
    }

    const doc: ReceiptDoc = {
      type: "RECEIPT",
      version: 1,
      requestId: r.id,
      signedAt: new Date().toISOString(),
      employee: { id: r.requester.id, fullName: r.requester.fullName, employeeNumber: r.requester.employeeNumber, unit: r.requester.unit.name },
      issuedBy: r.transactions[0]?.performedBy.fullName ?? 'מרלו"ג',
      items: r.catalogItem.requiresSerial
        ? r.allocatedSerials.map((s) => ({ sku: r.catalogItem.sku, name: r.catalogItem.name, serialNumber: s.serialNumber, quantity: 1 }))
        : [{ sku: r.catalogItem.sku, name: r.catalogItem.name, serialNumber: null, quantity: r.quantity }],
      terms: RECEIPT_TERMS,
    };
    const documentJson = canonicalJson(doc);

    const signature = await tx.signature.create({
      data: {
        kind: "RECEIPT",
        signerId: actor.id,
        imageData: input.imageData,
        documentJson,
        documentHash: sha256(documentJson),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent?.slice(0, 400) ?? null,
        signedAt: new Date(doc.signedAt),
      },
    });

    await transition(tx, r.id, "ALLOCATED", { status: "FULFILLED" });

    if (r.catalogItem.requiresSerial) {
      const res = await tx.inventorySerial.updateMany({
        where: { id: { in: r.allocatedSerials.map((s) => s.id) }, status: "ALLOCATED" },
        data: { status: "SIGNED", holderId: actor.id },
      });
      if (res.count !== r.allocatedSerials.length) throw new RequestError("מצב הציוד השתנה – רענן ונסה שוב");
      for (const s of r.allocatedSerials) {
        await tx.transaction.create({
          data: { type: "ISSUE", catalogItemId: r.catalogItemId, serialId: s.id, quantity: 1, toUserId: actor.id, performedById: actor.id, signatureId: signature.id, requestId: r.id },
        });
      }
      await recalcSerialCounters(tx, r.catalogItemId);
    } else {
      // הכמות כבר הופחתה מהמלאי הזמין בשלב ההקצאה – כאן רק נרשמת אצל העובד
      await tx.quantityHolding.upsert({
        where: { catalogItemId_userId: { catalogItemId: r.catalogItemId, userId: actor.id } },
        create: { catalogItemId: r.catalogItemId, userId: actor.id, quantity: r.quantity },
        update: { quantity: { increment: r.quantity } },
      });
      await tx.transaction.create({
        data: { type: "ISSUE", catalogItemId: r.catalogItemId, quantity: r.quantity, toUserId: actor.id, performedById: actor.id, signatureId: signature.id, requestId: r.id },
      });
    }
    return { signatureId: signature.id, doc };
  });
}
