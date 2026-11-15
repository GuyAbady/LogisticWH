import "server-only";
import { db } from "./db";
import { recalcSerialCounters } from "./inventory";
import { createSignedDoc } from "./returns";
import { ISSUE_TO_MANAGER_TERMS, type DocLine } from "./receipt";
import type { Role } from "@/generated/prisma/enums";

/*
 * ניפוק ישיר מהמרלו"ג (ללא בקשה מוקדמת): המחסנאי בוחר מקבל ופריטים, המקבל חותם על מכשיר המרלו"ג.
 * סידורי: IN_STOCK → SIGNED אצל המקבל; כמותי: הפחתה מותנית מהזמין + יתרה אצל המקבל.
 * ניפוק למנהל יחידה = אותו תהליך, בנוסח "לחלוקה לעובדי היחידה"; משם – פעולות מרוכזות.
 */

export class IssueError extends Error {
  override name = "IssueError";
}

type Actor = { id: string; role: Role; unitId: string; fullName: string };
export type IssueLine = { kind: "serial"; serialId: string } | { kind: "qty"; catalogItemId: string; quantity: number };

export async function directIssue(
  actor: Actor,
  input: { recipientId: string; lines: IssueLine[]; imageData: string; ipAddress: string | null; userAgent: string | null },
) {
  if (input.lines.length === 0) throw new IssueError("לא נבחרו פריטים לניפוק");
  return db.$transaction(async (tx) => {
    const r = await tx.user.findUnique({ where: { id: input.recipientId }, include: { unit: true } });
    if (!r || !r.isActive) throw new IssueError("המקבל אינו פעיל או אינו קיים");

    const docLines: DocLine[] = [];
    const txRows: { catalogItemId: string; serialId: string | null; quantity: number }[] = [];
    const touched = new Set<string>();

    for (const l of input.lines) {
      if (l.kind === "serial") {
        const s = await tx.inventorySerial.findUnique({ where: { id: l.serialId }, include: { catalogItem: true } });
        if (!s) throw new IssueError("מספר סידורי לא נמצא");
        // עדכון מותנה – מונע ניפוק כפול של אותו פריט במקביל
        const res = await tx.inventorySerial.updateMany({
          where: { id: s.id, status: "IN_STOCK", holderId: null },
          data: { status: "SIGNED", holderId: r.id },
        });
        if (res.count !== 1) throw new IssueError(`${s.serialNumber} אינו זמין עוד במחסן – רענן ובחר שוב`);
        touched.add(s.catalogItemId);
        txRows.push({ catalogItemId: s.catalogItemId, serialId: s.id, quantity: 1 });
        docLines.push({ employeeId: r.id, employeeName: r.fullName, employeeNumber: r.employeeNumber, sku: s.catalogItem.sku, name: s.catalogItem.name, serialNumber: s.serialNumber, quantity: 1, condition: null });
      } else {
        if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new IssueError("כמות לא תקינה");
        const item = await tx.catalogItem.findUnique({ where: { id: l.catalogItemId } });
        if (!item || item.requiresSerial) throw new IssueError("פריט כמותי לא נמצא");
        const res = await tx.catalogItem.updateMany({
          where: { id: item.id, availableQty: { gte: l.quantity } },
          data: { availableQty: { decrement: l.quantity } },
        });
        if (res.count !== 1) throw new IssueError(`אין מספיק ${item.name} במחסן (זמין ${item.availableQty})`);
        await tx.quantityHolding.upsert({
          where: { catalogItemId_userId: { catalogItemId: item.id, userId: r.id } },
          create: { catalogItemId: item.id, userId: r.id, quantity: l.quantity },
          update: { quantity: { increment: l.quantity } },
        });
        txRows.push({ catalogItemId: item.id, serialId: null, quantity: l.quantity });
        docLines.push({ employeeId: r.id, employeeName: r.fullName, employeeNumber: r.employeeNumber, sku: item.sku, name: item.name, serialNumber: null, quantity: l.quantity, condition: null });
      }
    }

    // המקבל הוא החותם (חתם על מכשיר המרלו"ג); המבצע נרשם ביומן התנועות
    const { sig } = await createSignedDoc(tx, {
      kind: "RECEIPT", type: "ISSUE",
      signer: { id: r.id, role: r.role, unitId: r.unitId, fullName: r.fullName },
      unit: r.unit.name, lines: docLines, reference: `ניפוק ע"י ${actor.fullName}`,
      imageData: input.imageData, ipAddress: input.ipAddress, userAgent: input.userAgent,
      terms: r.role === "UNIT_MANAGER" ? ISSUE_TO_MANAGER_TERMS : undefined,
    });
    for (const t of txRows) {
      await tx.transaction.create({
        data: { type: "ISSUE", ...t, toUserId: r.id, performedById: actor.id, signatureId: sig.id, note: "ניפוק ישיר" },
      });
    }
    for (const id of touched) await recalcSerialCounters(tx, id);
    return { signatureId: sig.id, recipient: r, lines: docLines };
  });
}
