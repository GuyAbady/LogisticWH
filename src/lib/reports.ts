import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import type { SerialStatus, TransactionType } from "@/generated/prisma/enums";

/* שאילתות משותפות למסכי האיתור ולייצוא ל-Excel – מקור אחד לשניהם */

export const TX_LABELS: Record<TransactionType, string> = {
  STOCK_IN: "קליטת מלאי",
  ALLOCATE: "הקצאה",
  DEALLOCATE: "שחרור הקצאה",
  ISSUE: "מסירה וחתימה",
  RETURN: "החזרה וזיכוי",
  TRANSFER: "העברה",
  ADJUST: "תיקון מלאי",
  REPAIR_OUT: "יציאה לתיקון",
  REPAIR_IN: "חזרה מתיקון",
  WRITE_OFF: "גריעה",
};

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  IN_STOCK: "במחסן",
  ALLOCATED: "הוקצה – ממתין לאיסוף",
  PENDING_ACK: "ממתין לאישור עובד",
  SIGNED: "חתום",
  PENDING_RETURN: "זומן להחזרה",
  IN_REPAIR: "בתיקון",
  WRITTEN_OFF: "נגרע",
};

export type AssignmentFilter = { userId?: string; unitId?: string; catalogItemId?: string };

export type AssignmentRow = {
  kind: "SERIAL" | "QUANTITY";
  catalogItemId: string;
  sku: string;
  itemName: string;
  category: string;
  serialId: string | null;
  serialNumber: string | null;
  quantity: number;
  pendingAckQty: number;
  status: string;
  serialStatus: SerialStatus | null;
  userId: string;
  userName: string;
  employeeNumber: string;
  unitId: string;
  unitName: string;
  signedAt: Date | null;
};

/** כל הציוד המשויך לעובדים (סידורי + כמותי), עם סינון אופציונלי */
export async function getAssignments(f: AssignmentFilter = {}): Promise<AssignmentRow[]> {
  const userWhere: Prisma.UserWhereInput = {
    ...(f.userId ? { id: f.userId } : {}),
    ...(f.unitId ? { unitId: f.unitId } : {}),
  };
  const userSelect = {
    id: true,
    fullName: true,
    employeeNumber: true,
    unit: { select: { id: true, name: true } },
  } as const;

  const [serials, holdings, issueDates] = await Promise.all([
    db.inventorySerial.findMany({
      where: {
        holderId: { not: null },
        ...(f.catalogItemId ? { catalogItemId: f.catalogItemId } : {}),
        holder: userWhere,
      },
      include: {
        catalogItem: { select: { sku: true, name: true, category: true } },
        holder: { select: userSelect },
        transactions: { where: { type: "ISSUE" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    db.quantityHolding.findMany({
      where: {
        OR: [{ quantity: { gt: 0 } }, { pendingAckQty: { gt: 0 } }],
        ...(f.catalogItemId ? { catalogItemId: f.catalogItemId } : {}),
        user: userWhere,
      },
      include: {
        catalogItem: { select: { sku: true, name: true, category: true } },
        user: { select: userSelect },
      },
    }),
    // תאריך חתימה אחרון לכל צמד פריט-עובד (פריטים כמותיים)
    db.transaction.groupBy({
      by: ["catalogItemId", "toUserId"],
      where: { type: "ISSUE", serialId: null, toUserId: { not: null } },
      _max: { createdAt: true },
    }),
  ]);

  const lastIssue = new Map(issueDates.map((g) => [`${g.catalogItemId}:${g.toUserId}`, g._max.createdAt]));

  const rows: AssignmentRow[] = [
    ...serials.map((s) => ({
      kind: "SERIAL" as const,
      catalogItemId: s.catalogItemId,
      sku: s.catalogItem.sku,
      itemName: s.catalogItem.name,
      category: s.catalogItem.category,
      serialId: s.id,
      serialNumber: s.serialNumber,
      quantity: 1,
      pendingAckQty: s.status === "PENDING_ACK" ? 1 : 0,
      status: SERIAL_STATUS_LABELS[s.status],
      serialStatus: s.status,
      userId: s.holder!.id,
      userName: s.holder!.fullName,
      employeeNumber: s.holder!.employeeNumber,
      unitId: s.holder!.unit.id,
      unitName: s.holder!.unit.name,
      signedAt: s.transactions[0]?.createdAt ?? null,
    })),
    ...holdings.map((h) => ({
      kind: "QUANTITY" as const,
      catalogItemId: h.catalogItemId,
      sku: h.catalogItem.sku,
      itemName: h.catalogItem.name,
      category: h.catalogItem.category,
      serialId: null,
      serialNumber: null,
      quantity: h.quantity,
      pendingAckQty: h.pendingAckQty,
      status: h.pendingAckQty > 0 ? "חלקי – ממתין לאישור" : "חתום",
      serialStatus: null,
      userId: h.user.id,
      userName: h.user.fullName,
      employeeNumber: h.user.employeeNumber,
      unitId: h.user.unit.id,
      unitName: h.user.unit.name,
      signedAt: lastIssue.get(`${h.catalogItemId}:${h.userId}`) ?? null,
    })),
  ];
  return rows.sort(
    (a, b) => a.unitName.localeCompare(b.unitName, "he") || a.userName.localeCompare(b.userName, "he") || a.itemName.localeCompare(b.itemName, "he"),
  );
}

export type HistoryFilter = { userId?: string; serialId?: string; catalogItemId?: string; unitId?: string };

/** היסטוריית תנועות מיומן התנועות */
export async function getHistory(f: HistoryFilter, take = 200) {
  // AND מפורש – כדי ששני תנאי OR (עובד + יחידה) לא ידרסו זה את זה
  const and: Prisma.TransactionWhereInput[] = [];
  if (f.serialId) and.push({ serialId: f.serialId });
  if (f.catalogItemId) and.push({ catalogItemId: f.catalogItemId });
  if (f.userId) and.push({ OR: [{ toUserId: f.userId }, { fromUserId: f.userId }] });
  if (f.unitId) and.push({ OR: [{ toUser: { unitId: f.unitId } }, { fromUser: { unitId: f.unitId } }] });
  const where: Prisma.TransactionWhereInput = { AND: and };
  return db.transaction.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      catalogItem: { select: { sku: true, name: true } },
      serial: { select: { serialNumber: true } },
      fromUser: { select: { fullName: true } },
      toUser: { select: { fullName: true } },
      performedBy: { select: { fullName: true } },
    },
  });
}

/** פילוח מיקום פריט: מחסן / תיקון / לפי יחידה ועובד */
export async function getItemLocation(catalogItemId: string) {
  const [item, assignments, inRepair] = await Promise.all([
    db.catalogItem.findUnique({ where: { id: catalogItemId } }),
    getAssignments({ catalogItemId }),
    db.inventorySerial.count({ where: { catalogItemId, status: "IN_REPAIR" } }),
  ]);
  if (!item) return null;
  const byUnit = new Map<string, { unitId: string; unitName: string; quantity: number }>();
  for (const a of assignments) {
    const u = byUnit.get(a.unitId) ?? { unitId: a.unitId, unitName: a.unitName, quantity: 0 };
    u.quantity += a.quantity;
    byUnit.set(a.unitId, u);
  }
  return {
    item,
    inStock: item.availableQty,
    inRepair,
    assigned: assignments.reduce((s, a) => s + a.quantity, 0),
    byUnit: [...byUnit.values()].sort((a, b) => b.quantity - a.quantity),
    assignments,
  };
}

/** חיפוש גלובלי: עובדים, יחידות, פריטי קטלוג ומספרים סידוריים */
export async function globalSearch(q: string) {
  const term = q.trim();
  if (term.length < 2) return null;
  const contains = { contains: term, mode: "insensitive" as const };
  const [users, units, items, serials] = await Promise.all([
    db.user.findMany({
      where: { OR: [{ fullName: contains }, { employeeNumber: contains }, { email: contains }, { phone: contains }] },
      take: 20,
      select: { id: true, fullName: true, employeeNumber: true, isActive: true, role: true, unit: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    db.unit.findMany({
      where: { OR: [{ name: contains }, { code: contains }] },
      take: 10,
      select: { id: true, name: true, code: true, _count: { select: { users: true } } },
    }),
    db.catalogItem.findMany({
      where: { OR: [{ sku: contains }, { name: contains }, { category: contains }] },
      take: 20,
      select: { id: true, sku: true, name: true, requiresSerial: true, availableQty: true, totalQuantity: true },
      orderBy: { name: "asc" },
    }),
    db.inventorySerial.findMany({
      where: { serialNumber: contains },
      take: 20,
      select: {
        id: true,
        serialNumber: true,
        status: true,
        catalogItem: { select: { name: true } },
        holder: { select: { fullName: true } },
      },
    }),
  ]);
  return { users, units, items, serials };
}
