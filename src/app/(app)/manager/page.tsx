import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getUserEquipment } from "@/lib/queries";
import { PageHeader, StatCard } from "@/components/ui";
import EquipmentList from "@/components/EquipmentList";

export const metadata: Metadata = { title: "מצבת היחידה" };

export default async function ManagerHome({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const user = await requireRole("UNIT_MANAGER");
  const { employee } = await searchParams;

  const [employees, pendingRequests] = await Promise.all([
    db.user.findMany({
      where: { unitId: user.unitId, isActive: true },
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        _count: { select: { serialItems: true } },
        quantityHoldings: { select: { quantity: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    db.equipmentRequest.count({ where: { unitId: user.unitId, status: "PENDING_MANAGER" } }),
  ]);

  // אבטחה: מסננים רק עובדים מהיחידה של המנהל (לא סומכים על הפרמטר מה-URL)
  const selected = employees.find((e) => e.id === employee);
  const equipment = selected ? await getUserEquipment(selected.id) : null;
  const totalSerial = employees.reduce((s, e) => s + e._count.serialItems, 0);

  return (
    <>
      <PageHeader title={`מצבת ציוד – ${user.unit.name}`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="עובדים ביחידה" value={employees.length} />
        <StatCard label="פריטים סידוריים חתומים" value={totalSerial} />
        <StatCard label="בקשות ממתינות לאישורך" value={pendingRequests} />
      </div>

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
                    href={`/manager?employee=${e.id}`}
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
