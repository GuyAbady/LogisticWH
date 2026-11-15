import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity, AlarmClock, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, Gauge, LayoutDashboard,
  PackageCheck, Plus, Search, Undo2, Users, Warehouse, Wrench,
} from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { dailyActivity } from "@/lib/dashboard";
import { TX_LABELS } from "@/lib/reports";
import { PageHeader, StatCard, EmptyState, fmtDateTime } from "@/components/ui";
import { ExportButton } from "@/components/data";
import { ChartCard, Legend, MeterList, RankedBars, SERIES, ThinSegmentedBar } from "@/components/charts";
import StackedColumns from "@/components/charts/StackedColumns";
import ItemIcon from "@/components/ItemIcon";

export const metadata: Metadata = { title: 'לוח בקרה – מרלו"ג' };

const TX_ICON = { STOCK_IN: ArrowDownToLine, ISSUE: ArrowUpFromLine, RETURN: Undo2, REPAIR_OUT: Wrench } as const;
const ACTIVITY_SERIES = [
  { name: "קליטות", color: SERIES[0] },
  { name: "מסירות", color: SERIES[1] },
  { name: "החזרות", color: SERIES[2] },
];
const STOCK_PARTS = [
  { name: "במחסן", color: SERIES[0] },
  { name: "משויך", color: SERIES[1] },
  { name: "בתיקון", color: SERIES[2] },
];

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jerusalem" }).format(now));
  return h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
}

export default async function WarehouseHome() {
  const me = await requireRole("WAREHOUSE_MANAGER");

  const [items, repair, pendingWarehouse, allocated, openSummons, overdue, recentTx, activity, statusCounts] = await Promise.all([
    db.catalogItem.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.inventorySerial.groupBy({ by: ["catalogItemId"], where: { status: "IN_REPAIR" }, _count: true }),
    db.equipmentRequest.count({ where: { status: "PENDING_WAREHOUSE" } }),
    db.equipmentRequest.count({ where: { status: "ALLOCATED" } }),
    db.returnSummons.count({ where: { status: "PENDING_RETURN" } }),
    db.returnSummons.count({ where: { status: "PENDING_RETURN", dueDate: { lt: new Date() } } }),
    db.transaction.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { catalogItem: { select: { name: true, category: true } }, toUser: { select: { fullName: true } }, fromUser: { select: { fullName: true } }, serial: { select: { serialNumber: true } } },
    }),
    dailyActivity(14),
    db.equipmentRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  const repairMap = new Map(repair.map((r) => [r.catalogItemId, r._count]));
  const rows = items.map((i) => {
    const inRepair = repairMap.get(i.id) ?? 0;
    return { ...i, inRepair, assigned: i.totalQuantity - i.availableQty - inRepair };
  });
  const inStock = rows.reduce((s, i) => s + i.availableQty, 0);
  const assigned = rows.reduce((s, i) => s + i.assigned, 0);
  const inRepairTotal = rows.reduce((s, i) => s + i.inRepair, 0);
  // מלאי נמוך: הפריטים עם יחס הזמינות הנמוך ביותר
  const lowest = [...rows].filter((r) => r.totalQuantity > 0).sort((a, b) => a.availableQty / a.totalQuantity - b.availableQty / b.totalQuantity).slice(0, 6);
  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const pipeline = [
    { id: "pm", label: "ממתין למנהל", value: count("PENDING_MANAGER") },
    { id: "pw", label: 'ממתין למרלו"ג', value: count("PENDING_WAREHOUSE"), href: "/warehouse/requests" },
    { id: "al", label: "ממתין לחתימה", value: count("ALLOCATED"), href: "/warehouse/requests" },
    { id: "fu", label: "נמסר ונחתם", value: count("FULFILLED") },
  ];
  const totalActivity = activity.reduce((s, d) => s + d.values.reduce((a, b) => a + b, 0), 0);

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title={`${greeting()}, ${me.fullName.split(" ")[0]}`}
        subtitle={new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeZone: "Asia/Jerusalem" }).format(new Date())}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/warehouse/lookup" className="btn-secondary"><Search className="size-4" aria-hidden /> איתור</Link>
            <Link href="/warehouse/inventory/new" className="btn-secondary"><Plus className="size-4" aria-hidden /> פריט חדש</Link>
            <Link href="/warehouse/users" className="btn-secondary"><Users className="size-4" aria-hidden /> משתמשים</Link>
            <ExportButton report="inventory" label="דוח מלאי" />
          </div>
        }
      />

      {/* שורת מדדים */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="יחידות במחסן" value={inStock.toLocaleString("he-IL")} hint={`מתוך ${(inStock + assigned + inRepairTotal).toLocaleString("he-IL")} בארגון`} icon={<Warehouse className="size-4" />} tone="blue" />
        <StatCard label="משויך לעובדים" value={assigned.toLocaleString("he-IL")} icon={<PackageCheck className="size-4" />} tone="green" />
        <StatCard label="בתיקון" value={inRepairTotal} icon={<Wrench className="size-4" />} tone="slate" />
        <StatCard label="דרישות להקצאה" value={pendingWarehouse} hint={`${allocated} ממתינות לחתימה`} icon={<ClipboardList className="size-4" />} tone="violet" href="/warehouse/requests" />
        <StatCard label="זימוני החזרה" value={openSummons} hint={overdue ? `${overdue} באיחור` : "אין איחורים"} icon={<AlarmClock className="size-4" />} tone={overdue ? "red" : "amber"} href="/warehouse/returns" />
        <StatCard label="פריטי קטלוג" value={items.length} icon={<Boxes className="size-4" />} tone="slate" href="/warehouse/inventory" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          icon={<Activity className="size-4" />}
          title="פעילות המרלו״ג – 14 ימים אחרונים"
          subtitle={`${totalActivity} פעולות · מספר פעולות ליום לפי סוג`}
          table={
            <table className="table-base">
              <thead><tr><th>תאריך</th>{ACTIVITY_SERIES.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
              <tbody>{activity.map((d) => <tr key={d.key}><td>{d.full}</td>{d.values.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
            </table>
          }
        >
          <div className="mb-4"><Legend items={ACTIVITY_SERIES.map((s) => ({ label: s.name, color: s.color }))} /></div>
          <StackedColumns data={activity} series={ACTIVITY_SERIES} />
        </ChartCard>

        <ChartCard icon={<Gauge className="size-4" />} title="זמינות מלאי" subtitle="הפריטים עם השיעור הזמין הנמוך ביותר במחסן">
          {lowest.length === 0 ? <EmptyState text="אין פריטים" /> : (
            <MeterList rows={lowest.map((r) => ({
              id: r.id, name: r.name, href: `/warehouse/inventory/${r.id}`, value: r.availableQty, max: r.totalQuantity,
              icon: <ItemIcon name={r.name} category={r.category} size="sm" />,
            }))} />
          )}
        </ChartCard>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard icon={<Boxes className="size-4" />} title="מצב מלאי לפי פריט" subtitle="פילוח כל פריט: במחסן · משויך · בתיקון">
          <div className="mb-3"><Legend items={STOCK_PARTS.map((p) => ({ label: p.name, color: p.color }))} /></div>
          <ul className="divide-y divide-slate-100">
            {rows.map((i) => (
              <li key={i.id} className="grid grid-cols-[auto_1fr] items-center gap-3 py-2.5 sm:grid-cols-[auto_minmax(0,14rem)_1fr]">
                <ItemIcon name={i.name} category={i.category} size="sm" />
                <span className="min-w-0">
                  <Link href={`/warehouse/inventory/${i.id}`} className="link block truncate text-sm">{i.name}</Link>
                  <span className="ltr block text-right font-mono text-xs text-slate-500">{i.sku}</span>
                </span>
                <span className="col-span-2 flex items-center gap-3 sm:col-span-1">
                  <ThinSegmentedBar
                    label={i.name}
                    parts={[
                      { name: STOCK_PARTS[0].name, value: i.availableQty, color: STOCK_PARTS[0].color },
                      { name: STOCK_PARTS[1].name, value: i.assigned, color: STOCK_PARTS[1].color },
                      { name: STOCK_PARTS[2].name, value: i.inRepair, color: STOCK_PARTS[2].color },
                    ]}
                  />
                  <span className="tabular w-24 shrink-0 text-xs whitespace-nowrap text-slate-600">{i.availableQty} מתוך {i.totalQuantity}</span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <div className="space-y-6">
          <ChartCard icon={<ClipboardList className="size-4" />} title="בקשות ציוד לפי שלב" subtitle="מצב כל הבקשות במערכת">
            <RankedBars rows={pipeline} color={SERIES[0]} />
          </ChartCard>

          <ChartCard icon={<Activity className="size-4" />} title="תנועות אחרונות">
            {recentTx.length === 0 ? <EmptyState text="אין תנועות" /> : (
              <ol className="space-y-3">
                {recentTx.map((t) => {
                  const Icon = TX_ICON[t.type as keyof typeof TX_ICON] ?? Activity;
                  const who = t.toUser?.fullName ?? t.fromUser?.fullName;
                  return (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-hidden><Icon className="size-3.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">{TX_LABELS[t.type]}</span> · {t.catalogItem.name}
                        {t.serial && <span className="ltr mx-1 inline-block font-mono text-xs">{t.serial.serialNumber}</span>}
                        {!t.serial && t.quantity > 1 && <> ×{t.quantity}</>}
                        {who && <span className="block text-xs text-slate-600">{who}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{fmtDateTime(t.createdAt)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </ChartCard>
        </div>
      </div>
    </>
  );
}
