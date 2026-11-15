import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { buildWorkbook, xlsxResponse, type Sheet } from "@/lib/excel";
import { getAssignments, getHistory, SERIAL_STATUS_LABELS, TX_LABELS, type AssignmentRow } from "@/lib/reports";

// ייצוא דוחות ל-Excel. נתיבי /api אינם עוברים ב-proxy, ולכן ההרשאה נבדקת כאן במפורש.
export const dynamic = "force-dynamic";

const REPORTS = ["inventory", "assignments", "transactions", "user", "unit", "item", "serial"] as const;
type Report = (typeof REPORTS)[number];

const assignmentColumns: Sheet["columns"] = [
  { header: "יחידה", key: "unitName", width: 20 },
  { header: "עובד", key: "userName", width: 20 },
  { header: "מספר עובד", key: "employeeNumber", width: 12 },
  { header: 'מק"ט', key: "sku", width: 12 },
  { header: "פריט", key: "itemName", width: 28 },
  { header: "קטגוריה", key: "category", width: 14 },
  { header: "סוג", key: "kindLabel", width: 10 },
  { header: "מספר סידורי", key: "serialNumber", width: 16 },
  { header: "כמות", key: "quantity", width: 8, type: "number" },
  { header: "סטטוס", key: "status", width: 18 },
  { header: "תאריך חתימה", key: "signedAt", width: 18, type: "date" },
];

const assignmentRows = (rows: AssignmentRow[]) =>
  rows.map((r) => ({ ...r, kindLabel: r.kind === "SERIAL" ? "סידורי" : "כמותי", serialNumber: r.serialNumber ?? "" }));

const historyColumns: Sheet["columns"] = [
  { header: "תאריך", key: "createdAt", width: 18, type: "date" },
  { header: "פעולה", key: "typeLabel", width: 16 },
  { header: 'מק"ט', key: "sku", width: 12 },
  { header: "פריט", key: "itemName", width: 28 },
  { header: "מספר סידורי", key: "serialNumber", width: 16 },
  { header: "כמות", key: "quantity", width: 8, type: "number" },
  { header: "מאת", key: "from", width: 18 },
  { header: "אל", key: "to", width: 18 },
  { header: "בוצע ע\"י", key: "performedBy", width: 18 },
  { header: "הערה", key: "note", width: 30 },
];

async function historyRows(filter: Parameters<typeof getHistory>[0], take = 5000) {
  const tx = await getHistory(filter, take);
  return tx.map((t) => ({
    createdAt: t.createdAt,
    typeLabel: TX_LABELS[t.type],
    sku: t.catalogItem.sku,
    itemName: t.catalogItem.name,
    serialNumber: t.serial?.serialNumber ?? "",
    quantity: t.quantity,
    from: t.fromUser?.fullName ?? "מחסן",
    to: t.toUser?.fullName ?? "מחסן",
    performedBy: t.performedBy.fullName,
    note: t.note ?? "",
  }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ report: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  if (user.role !== "WAREHOUSE_MANAGER" && user.role !== "ADMIN") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { report } = await ctx.params;
  if (!REPORTS.includes(report as Report)) return NextResponse.json({ error: "דוח לא קיים" }, { status: 404 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

  let sheets: Sheet[];
  let name: string;

  switch (report as Report) {
    case "inventory": {
      const items = await db.catalogItem.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
      const repair = await db.inventorySerial.groupBy({ by: ["catalogItemId"], where: { status: "IN_REPAIR" }, _count: true });
      const repairMap = new Map(repair.map((r) => [r.catalogItemId, r._count]));
      const serials = await db.inventorySerial.findMany({
        orderBy: [{ catalogItem: { name: "asc" } }, { serialNumber: "asc" }],
        include: { catalogItem: { select: { sku: true, name: true } }, holder: { select: { fullName: true, unit: { select: { name: true } } } } },
      });
      sheets = [
        {
          name: "מלאי לפי פריט",
          columns: [
            { header: 'מק"ט', key: "sku", width: 12 },
            { header: "פריט", key: "name", width: 28 },
            { header: "קטגוריה", key: "category", width: 14 },
            { header: "סוג", key: "kind", width: 10 },
            { header: "סה\"כ בארגון", key: "totalQuantity", width: 12, type: "number" },
            { header: "במחסן (זמין)", key: "availableQty", width: 12, type: "number" },
            { header: "בתיקון", key: "inRepair", width: 10, type: "number" },
            { header: "משויך לעובדים", key: "assigned", width: 14, type: "number" },
            { header: "פעיל", key: "active", width: 8 },
          ],
          rows: items.map((i) => {
            const inRepair = repairMap.get(i.id) ?? 0;
            return {
              ...i,
              kind: i.requiresSerial ? "סידורי" : "כמותי",
              inRepair,
              assigned: i.totalQuantity - i.availableQty - inRepair,
              active: i.isActive ? "כן" : "לא",
            };
          }),
        },
        {
          name: "מספרים סידוריים",
          columns: [
            { header: 'מק"ט', key: "sku", width: 12 },
            { header: "פריט", key: "itemName", width: 28 },
            { header: "מספר סידורי", key: "serialNumber", width: 18 },
            { header: "סטטוס", key: "status", width: 18 },
            { header: "מחזיק", key: "holder", width: 18 },
            { header: "יחידה", key: "unit", width: 18 },
            { header: "עודכן", key: "updatedAt", width: 18, type: "date" },
          ],
          rows: serials.map((s) => ({
            sku: s.catalogItem.sku,
            itemName: s.catalogItem.name,
            serialNumber: s.serialNumber,
            status: SERIAL_STATUS_LABELS[s.status],
            holder: s.holder?.fullName ?? "",
            unit: s.holder?.unit.name ?? "",
            updatedAt: s.updatedAt,
          })),
        },
      ];
      name = `דוח-מלאי-${stamp}.xlsx`;
      break;
    }
    case "assignments": {
      sheets = [{ name: "שיוכי ציוד", columns: assignmentColumns, rows: assignmentRows(await getAssignments()) }];
      name = `דוח-שיוכים-${stamp}.xlsx`;
      break;
    }
    case "transactions": {
      sheets = [{ name: "יומן תנועות", columns: historyColumns, rows: await historyRows({}) }];
      name = `יומן-תנועות-${stamp}.xlsx`;
      break;
    }
    case "user": {
      const u = await db.user.findUnique({ where: { id }, select: { id: true, fullName: true } });
      if (!u) return NextResponse.json({ error: "עובד לא נמצא" }, { status: 404 });
      sheets = [
        { name: "ציוד רשום", columns: assignmentColumns, rows: assignmentRows(await getAssignments({ userId: u.id })) },
        { name: "היסטוריה", columns: historyColumns, rows: await historyRows({ userId: u.id }) },
      ];
      name = `תיק-ציוד-${u.fullName}-${stamp}.xlsx`;
      break;
    }
    case "unit": {
      const unit = await db.unit.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!unit) return NextResponse.json({ error: "יחידה לא נמצאה" }, { status: 404 });
      sheets = [
        { name: "ציוד רשום", columns: assignmentColumns, rows: assignmentRows(await getAssignments({ unitId: unit.id })) },
        { name: "היסטוריה", columns: historyColumns, rows: await historyRows({ unitId: unit.id }) },
      ];
      name = `ציוד-יחידה-${unit.name}-${stamp}.xlsx`;
      break;
    }
    case "item": {
      const item = await db.catalogItem.findUnique({ where: { id }, select: { id: true, sku: true } });
      if (!item) return NextResponse.json({ error: "פריט לא נמצא" }, { status: 404 });
      sheets = [
        { name: "שיוכים", columns: assignmentColumns, rows: assignmentRows(await getAssignments({ catalogItemId: item.id })) },
        { name: "היסטוריה", columns: historyColumns, rows: await historyRows({ catalogItemId: item.id }) },
      ];
      name = `איתור-פריט-${item.sku}-${stamp}.xlsx`;
      break;
    }
    case "serial": {
      const s = await db.inventorySerial.findUnique({ where: { id }, select: { id: true, serialNumber: true } });
      if (!s) return NextResponse.json({ error: "מספר סידורי לא נמצא" }, { status: 404 });
      sheets = [{ name: "היסטוריית החזקה", columns: historyColumns, rows: await historyRows({ serialId: s.id }) }];
      name = `היסטוריה-${s.serialNumber}-${stamp}.xlsx`;
      break;
    }
  }

  await audit({ userId: user.id, action: "EXPORT", entity: report, entityId: id || undefined });
  return xlsxResponse(await buildWorkbook(name, sheets), name);
}
