import { Building2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAssignments } from "@/lib/reports";
import { ROLE_LABELS } from "@/lib/roles";
import { PageHeader, StatCard } from "@/components/ui";
import { AssignmentTable, ExportButton } from "@/components/data";

export const metadata = { title: "ציוד יחידה" };

export default async function UnitFolder({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { id } = await params;
  const unit = await db.unit.findUnique({
    where: { id },
    include: { users: { orderBy: { fullName: "asc" }, select: { id: true, fullName: true, employeeNumber: true, role: true, isActive: true } } },
  });
  if (!unit) notFound();
  const rows = await getAssignments({ unitId: id });

  // סיכום לפי פריט ברמת היחידה
  const byItem = new Map<string, { name: string; sku: string; id: string; qty: number }>();
  for (const r of rows) {
    const e = byItem.get(r.catalogItemId) ?? { name: r.itemName, sku: r.sku, id: r.catalogItemId, qty: 0 };
    e.qty += r.quantity;
    byItem.set(r.catalogItemId, e);
  }

  return (
    <>
      <PageHeader icon={<Building2 className="size-5" />} title={`ציוד יחידה – ${unit.name}`} subtitle={`קוד ${unit.code}`} actions={<ExportButton report="unit" id={unit.id} />} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="עובדים" value={unit.users.length} />
        <StatCard label="פריטים סידוריים" value={rows.filter((r) => r.kind === "SERIAL").length} />
        <StatCard label="יחידות כמותיות" value={rows.filter((r) => r.kind === "QUANTITY").reduce((s, r) => s + r.quantity, 0)} />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-bold">סיכום לפי פריט</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {[...byItem.values()].map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <Link href={`/warehouse/inventory/${i.id}`} className="link">{i.name}</Link>
                <span className="font-bold">{i.qty}</span>
              </li>
            ))}
            {byItem.size === 0 && <li className="py-2 text-slate-500">אין ציוד</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-2 font-bold">עובדי היחידה</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {unit.users.map((u) => (
              <li key={u.id} className="flex justify-between py-2">
                <Link href={`/warehouse/lookup/user/${u.id}`} className="link">
                  {u.fullName} <span className="text-xs text-slate-500">({u.employeeNumber})</span>
                </Link>
                <span className="text-xs text-slate-500">{ROLE_LABELS[u.role]}{!u.isActive && " · לא פעיל"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card">
        <h2 className="mb-3 font-bold">כל הציוד הרשום ביחידה</h2>
        <AssignmentTable rows={rows} show={{ user: true, item: true }} />
      </section>
    </>
  );
}
