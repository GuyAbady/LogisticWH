import "server-only";
import { db } from "./db";
import { createSignedDoc } from "./returns";
import type { DocLine } from "./receipt";
import type { Role } from "@/generated/prisma/enums";

/*
 * פעולות מרוכזות של מנהל יחידה (החלטת המשתמש: "מנהל חותם, עובד מאשר"):
 *
 * חלוקה מרוכזת (BULK_TRANSFER): המנהל מחלק ציוד הרשום עליו לעובדי היחידה בחתימה אחת.
 *   סידורי → מועבר לעובד בסטטוס PENDING_ACK; כמותי → pendingAckQty אצל העובד.
 *   עד שהעובד מאשר (ACK) האחריות נשארת על המנהל. העובד יכול גם לדחות – הציוד חוזר למנהל.
 *
 * זיכוי מרוכז (BULK_COLLECT): המנהל אוסף ציוד מעובדי היחידה בחתימה אחת –
 *   הציוד עובר אליו והעובדים מזוכים. משם הוא מחזיר למרלו"ג בקליטת החזרה רגילה.
 *
 * מנהל פועל רק על עובדים פעילים ביחידה שלו (בדיקה בשרת).
 */

export class BulkError extends Error {
  override name = "BulkError";
}

type Actor = { id: string; role: Role; unitId: string; fullName: string };
type Sig = { imageData: string; ipAddress: string | null; userAgent: string | null };

export type BulkLine =
  | { kind: "serial"; employeeId: string; serialId: string }
  | { kind: "qty"; employeeId: string; catalogItemId: string; quantity: number };

async function unitEmployees(manager: Actor, ids: string[]) {
  const emps = await db.user.findMany({
    where: { id: { in: [...new Set(ids)] }, unitId: manager.unitId, isActive: true, NOT: { id: manager.id } },
    include: { unit: true },
  });
  if (emps.length !== new Set(ids).size) throw new BulkError("ניתן לבחור רק עובדים פעילים מהיחידה שלך");
  return new Map(emps.map((e) => [e.id, e]));
}

/** חלוקה מרוכזת מהציוד הרשום על המנהל */
export async function bulkTransfer(manager: Actor, lines: BulkLine[], sig: Sig) {
  if (!lines.length) throw new BulkError("לא נבחרו פריטים לחלוקה");
  const emps = await unitEmployees(manager, lines.map((l) => l.employeeId));

  return db.$transaction(async (tx) => {
    const docLines: DocLine[] = [];
    const txRows: { catalogItemId: string; serialId: string | null; quantity: number; toUserId: string }[] = [];

    for (const l of lines) {
      const emp = emps.get(l.employeeId)!;
      if (l.kind === "serial") {
        const s = await tx.inventorySerial.findUnique({ where: { id: l.serialId }, include: { catalogItem: true } });
        if (!s) throw new BulkError("פריט לא נמצא");
        const res = await tx.inventorySerial.updateMany({
          where: { id: s.id, holderId: manager.id, status: "SIGNED" },
          data: { holderId: emp.id, status: "PENDING_ACK" },
        });
        if (res.count !== 1) throw new BulkError(`${s.serialNumber} אינו רשום עליך כחתום`);
        txRows.push({ catalogItemId: s.catalogItemId, serialId: s.id, quantity: 1, toUserId: emp.id });
        docLines.push({ employeeId: emp.id, employeeName: emp.fullName, employeeNumber: emp.employeeNumber, sku: s.catalogItem.sku, name: s.catalogItem.name, serialNumber: s.serialNumber, quantity: 1, condition: null });
      } else {
        if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new BulkError("כמות לא תקינה");
        const item = await tx.catalogItem.findUniqueOrThrow({ where: { id: l.catalogItemId } });
        const res = await tx.quantityHolding.updateMany({
          where: { catalogItemId: l.catalogItemId, userId: manager.id, quantity: { gte: l.quantity } },
          data: { quantity: { decrement: l.quantity } },
        });
        if (res.count !== 1) throw new BulkError(`אין ברשותך מספיק יחידות של ${item.name}`);
        await tx.quantityHolding.upsert({
          where: { catalogItemId_userId: { catalogItemId: l.catalogItemId, userId: emp.id } },
          create: { catalogItemId: l.catalogItemId, userId: emp.id, quantity: 0, pendingAckQty: l.quantity },
          update: { pendingAckQty: { increment: l.quantity } },
        });
        txRows.push({ catalogItemId: l.catalogItemId, serialId: null, quantity: l.quantity, toUserId: emp.id });
        docLines.push({ employeeId: emp.id, employeeName: emp.fullName, employeeNumber: emp.employeeNumber, sku: item.sku, name: item.name, serialNumber: null, quantity: l.quantity, condition: null });
      }
    }

    const unitName = [...emps.values()][0].unit.name;
    const { sig: signature } = await createSignedDoc(tx, {
      kind: "MANAGER_BULK", type: "BULK_TRANSFER", signer: manager, unit: unitName, lines: docLines, reference: null, ...sig,
    });
    for (const r of txRows) {
      await tx.transaction.create({
        data: { type: "TRANSFER", ...r, fromUserId: manager.id, performedById: manager.id, signatureId: signature.id, requiresAck: true },
      });
    }
    return { signatureId: signature.id, employees: [...new Set(txRows.map((r) => r.toUserId))].map((id) => emps.get(id)!) };
  });
}

/** אישור העובד להעברות הממתינות לו (חתימה אחת לכל ההעברות שנבחרו) */
export async function acknowledgeTransfers(employee: Actor, txIds: string[], sig: Sig) {
  if (!txIds.length) throw new BulkError("לא נבחרו פריטים לאישור");
  return db.$transaction(async (tx) => {
    const rows = await tx.transaction.findMany({
      where: { id: { in: txIds }, toUserId: employee.id, type: "TRANSFER", requiresAck: true, ackAt: null },
      include: { catalogItem: true, serial: true },
    });
    if (rows.length !== new Set(txIds).size) throw new BulkError("חלק מההעברות כבר טופלו – רענן את הדף");
    const me = await tx.user.findUniqueOrThrow({ where: { id: employee.id }, include: { unit: true } });

    for (const r of rows) {
      if (r.serialId) {
        const res = await tx.inventorySerial.updateMany({ where: { id: r.serialId, holderId: employee.id, status: "PENDING_ACK" }, data: { status: "SIGNED" } });
        if (res.count !== 1) throw new BulkError("מצב הפריט השתנה – רענן את הדף");
      } else {
        const res = await tx.quantityHolding.updateMany({
          where: { catalogItemId: r.catalogItemId, userId: employee.id, pendingAckQty: { gte: r.quantity } },
          data: { pendingAckQty: { decrement: r.quantity }, quantity: { increment: r.quantity } },
        });
        if (res.count !== 1) throw new BulkError("מצב הכמות השתנה – רענן את הדף");
      }
    }
    const { sig: signature } = await createSignedDoc(tx, {
      kind: "EMPLOYEE_ACK", type: "ACK", signer: employee, unit: me.unit.name, reference: null, ...sig,
      lines: rows.map((r) => ({
        employeeId: me.id, employeeName: me.fullName, employeeNumber: me.employeeNumber,
        sku: r.catalogItem.sku, name: r.catalogItem.name, serialNumber: r.serial?.serialNumber ?? null, quantity: r.quantity, condition: null,
      })),
    });
    // עדכון שדות האישור בלבד – שאר הרשומה ביומן אינו משתנה
    await tx.transaction.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { ackAt: new Date(), ackSignatureId: signature.id } });
    return { signatureId: signature.id };
  });
}

/** דחיית העברה ע"י העובד – הציוד חוזר למנהל, ונרשמת תנועה הפוכה */
export async function rejectTransfer(employee: Actor, txId: string, note: string) {
  if (!note.trim()) throw new BulkError("יש לציין סיבה לדחייה");
  await db.$transaction(async (tx) => {
    const r = await tx.transaction.findFirst({ where: { id: txId, toUserId: employee.id, type: "TRANSFER", requiresAck: true, ackAt: null } });
    if (!r || !r.fromUserId) throw new BulkError("ההעברה כבר טופלה");
    if (r.serialId) {
      const res = await tx.inventorySerial.updateMany({ where: { id: r.serialId, holderId: employee.id, status: "PENDING_ACK" }, data: { holderId: r.fromUserId, status: "SIGNED" } });
      if (res.count !== 1) throw new BulkError("מצב הפריט השתנה");
    } else {
      const res = await tx.quantityHolding.updateMany({
        where: { catalogItemId: r.catalogItemId, userId: employee.id, pendingAckQty: { gte: r.quantity } },
        data: { pendingAckQty: { decrement: r.quantity } },
      });
      if (res.count !== 1) throw new BulkError("מצב הכמות השתנה");
      await tx.quantityHolding.upsert({
        where: { catalogItemId_userId: { catalogItemId: r.catalogItemId, userId: r.fromUserId } },
        create: { catalogItemId: r.catalogItemId, userId: r.fromUserId, quantity: r.quantity },
        update: { quantity: { increment: r.quantity } },
      });
    }
    // סגירת ההעברה המקורית (ללא חתימת אישור) ורישום תנועה הפוכה
    await tx.transaction.update({ where: { id: r.id }, data: { ackAt: new Date() } });
    await tx.transaction.create({
      data: {
        type: "TRANSFER", catalogItemId: r.catalogItemId, serialId: r.serialId, quantity: r.quantity,
        fromUserId: employee.id, toUserId: r.fromUserId, performedById: employee.id, note: `נדחה ע"י העובד: ${note.trim().slice(0, 200)}`,
      },
    });
  });
}

/** זיכוי מרוכז: המנהל אוסף ציוד מעובדי היחידה בחתימה אחת */
export async function bulkCollect(manager: Actor, lines: BulkLine[], sig: Sig) {
  if (!lines.length) throw new BulkError("לא נבחרו פריטים לזיכוי");
  const emps = await unitEmployees(manager, lines.map((l) => l.employeeId));

  return db.$transaction(async (tx) => {
    const docLines: DocLine[] = [];
    const txRows: { catalogItemId: string; serialId: string | null; quantity: number; fromUserId: string }[] = [];
    for (const l of lines) {
      const emp = emps.get(l.employeeId)!;
      if (l.kind === "serial") {
        const s = await tx.inventorySerial.findUnique({ where: { id: l.serialId }, include: { catalogItem: true } });
        if (!s) throw new BulkError("פריט לא נמצא");
        const res = await tx.inventorySerial.updateMany({
          where: { id: s.id, holderId: emp.id, status: { in: ["SIGNED", "PENDING_RETURN"] } },
          data: { holderId: manager.id, status: "SIGNED" },
        });
        if (res.count !== 1) throw new BulkError(`${s.serialNumber} אינו חתום על ${emp.fullName}`);
        // זימון פתוח לפריט עובר לטיפול המנהל – נסגר כאן, והמנהל יחזיר למרלו"ג
        await tx.returnSummons.updateMany({ where: { serialId: s.id, userId: emp.id, status: "PENDING_RETURN" }, data: { status: "CANCELLED", closedAt: new Date() } });
        txRows.push({ catalogItemId: s.catalogItemId, serialId: s.id, quantity: 1, fromUserId: emp.id });
        docLines.push({ employeeId: emp.id, employeeName: emp.fullName, employeeNumber: emp.employeeNumber, sku: s.catalogItem.sku, name: s.catalogItem.name, serialNumber: s.serialNumber, quantity: 1, condition: null });
      } else {
        if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new BulkError("כמות לא תקינה");
        const item = await tx.catalogItem.findUniqueOrThrow({ where: { id: l.catalogItemId } });
        const res = await tx.quantityHolding.updateMany({
          where: { catalogItemId: l.catalogItemId, userId: emp.id, quantity: { gte: l.quantity } },
          data: { quantity: { decrement: l.quantity } },
        });
        if (res.count !== 1) throw new BulkError(`ל${emp.fullName} אין ${l.quantity} יחידות של ${item.name}`);
        await tx.quantityHolding.upsert({
          where: { catalogItemId_userId: { catalogItemId: l.catalogItemId, userId: manager.id } },
          create: { catalogItemId: l.catalogItemId, userId: manager.id, quantity: l.quantity },
          update: { quantity: { increment: l.quantity } },
        });
        txRows.push({ catalogItemId: l.catalogItemId, serialId: null, quantity: l.quantity, fromUserId: emp.id });
        docLines.push({ employeeId: emp.id, employeeName: emp.fullName, employeeNumber: emp.employeeNumber, sku: item.sku, name: item.name, serialNumber: null, quantity: l.quantity, condition: null });
      }
    }
    const unitName = [...emps.values()][0].unit.name;
    const { sig: signature } = await createSignedDoc(tx, {
      kind: "MANAGER_BULK", type: "BULK_COLLECT", signer: manager, unit: unitName, lines: docLines, reference: null, ...sig,
    });
    for (const r of txRows) {
      await tx.transaction.create({ data: { type: "TRANSFER", ...r, toUserId: manager.id, performedById: manager.id, signatureId: signature.id } });
    }
    return { signatureId: signature.id, employees: [...new Set(txRows.map((r) => r.fromUserId))].map((id) => emps.get(id)!) };
  });
}
