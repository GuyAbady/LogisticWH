import type { Metadata } from "next";
import Link from "next/link";
import { actingUnit, requireRole } from "@/lib/dal";
import UnitSwitcher from "@/components/UnitSwitcher";
import { db } from "@/lib/db";
import { getUserEquipment } from "@/lib/queries";
import { PageHeader, StatCard } from "@/components/ui";
import { ChartCard, RankedBars } from "@/components/charts";
import { ClipboardList, Hash, UsersRound, BarChart3 } from "lucide-react";
import EquipmentList from "@/components/EquipmentList";

export const metadata: Metadata = { title: "מצבת היחידה" };

export default async function ManagerHome({ searchParams }: { searchParams: Promise<{ employee?: string; unit?: string }> }) {
  const user = await requireRole("UNIT_MANAGER");
  const { employee, unit: unitParam } = await searchParams;
  const unit = await actingUnit(user, unitParam);
  const q = user.role === "ADMIN" ? `unit=${unit.id}&` : "";

  const [employees, pendingRequests] = await Promise.all([
    db.user.findMany({
      where: { unitId: unit.id, isActive: true },
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        _count: { select: { serialItems: true } },
        quantityHoldings: { select: { quantity: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    db.equipmentRequest.count({ where: { unitId: unit.id, status: "PENDING_MANAGER" } }),
  ]);

  // אבטחה: מסננים רק עובדים מהיחידה של המנהל (לא סומכים על הפרמטר מה-URL)
  const selected = employees.find((e) => e.id === employee);
  const equipment = selected ? await getUserEquipment(selected.id) : null;
  const totalSerial = employees.reduce((s, e) => s + e._count.serialItems, 0);

  return (
    <>
      <PageHeader icon={<UsersRound className="size-5" />} title={`מצבת ציוד – ${unit.name}`} subtitle="הציוד החתום על עובדי היחידה" />
      {user.role === "ADMIN" && <UnitSwitcher current={unit.id} action="/manager" />}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="עובדים ביחידה" value={employees.length} icon={<UsersRound className="size-4" />} tone="blue" />
        <StatCard label="פריטים סידוריים חתומים" value={totalSerial} icon={<Hash className="size-4" />} tone="green" />
        <StatCard label="בקשות ממתינות לאישורך" value={pendingRequests} icon={<ClipboardList className="size-4" />} tone={pendingRequests ? "amber" : "slate"} href="/manager/requests" />
      </div>

      <ChartCard className="mb-6" icon={<BarChart3 className="size-4" />} title="ציוד לפי עובד" subtitle="סה״כ פריטים חתומים (סידוריים + יחידות כמותיות)">
        <RankedBars
          unit="פריטים"
          rows={employees
            .map((e) => ({ id: e.id, label: e.fullName, href: `/manager?${q}employee=${e.id}`, value: e._count.serialItems + e.quantityHoldings.reduce((s, h) => s + h.quantity, 0) }))
            .sort((a, b) => b.value - a.value)}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <section className="card p-2">
          <h2 className="px-2 py-2 font-bold">סינון לפי עובד</h2>
          <ul>
            {employees.map((e) => {
              const qty = e.quantityHoldings.reduce((s, h) => s + h.quantity, 0);
              const active = e.id === selected?.id;
              return (
                <li key={e.id}>
                  <Link
                    href={`/manager?${q}employee=${e.id}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-50 font-bold text-brand-700" : "hover:bg-slate-50"}`}
                  >
                    <span>{e.fullName} <span className="text-xs text-slate-500">({e.employeeNumber})</span></span>
                    <span className="text-xs text-slate-500">{e._count.serialItems} סידורי · {qty} כמותי</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          {selected && equipment ? (
            <>
              <h2 className="mb-3 text-lg font-bold">הציוד של {selected.fullName}</h2>
              <EquipmentList data={equipment} />
            </>
          ) : (
            <p className="card text-sm text-slate-600">בחר עובד מהרשימה כדי לצפות בציוד החתום עליו.</p>
          )}
        </section>
      </div>
    </>
  );
}
