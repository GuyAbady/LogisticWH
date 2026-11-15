import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Hash, Package, User, Search } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { globalSearch } from "@/lib/reports";
import { ROLE_LABELS } from "@/lib/roles";
import { PageHeader, EmptyState, SerialBadge } from "@/components/ui";
import { SearchBox, ExportButton } from "@/components/data";

export const metadata: Metadata = { title: "איתור מהיר" };

function Group({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section className="card">
      <h2 className="mb-2 flex items-center gap-2 font-bold">{icon} {title} ({count})</h2>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const q = ((await searchParams).q ?? "").slice(0, 80);
  const res = await globalSearch(q);
  const total = res ? res.users.length + res.units.length + res.items.length + res.serials.length : 0;

  return (
    <>
      <PageHeader
        icon={<Search className="size-5" />}
        title="איתור מהיר"
        subtitle='חיפוש לפי שם עובד, מספר עובד, יחידה, מק"ט, שם פריט או מספר סידורי'
        actions={<div className="flex flex-wrap gap-2"><ExportButton report="assignments" label="כל השיוכים" /><ExportButton report="transactions" label="יומן תנועות" /></div>}
      />
      <div className="mb-6"><SearchBox action="/warehouse/lookup" defaultValue={q} placeholder="לדוגמה: אבי / 2002 / LAP-001 / DL-1001" scan /></div>

      {q && q.length < 2 && <EmptyState text="יש להזין לפחות 2 תווים" />}
      {res && total === 0 && <EmptyState text={`לא נמצאו תוצאות עבור "${q}"`} />}
      {res && total > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Group icon={<User className="size-4" />} title="עובדים" count={res.users.length}>
            {res.users.map((u) => (
              <li key={u.id}>
                <Link href={`/warehouse/lookup/user/${u.id}`} className="flex justify-between gap-2 py-2 hover:bg-slate-50">
                  <span className="font-bold">{u.fullName} <span className="text-xs font-normal text-slate-500">({u.employeeNumber})</span>{!u.isActive && <span className="badge mr-1 bg-slate-200 text-slate-600">לא פעיל</span>}</span>
                  <span className="text-xs text-slate-500">{ROLE_LABELS[u.role]} · {u.unit.name}</span>
                </Link>
              </li>
            ))}
          </Group>
          <Group icon={<Building2 className="size-4" />} title="יחידות" count={res.units.length}>
            {res.units.map((u) => (
              <li key={u.id}>
                <Link href={`/warehouse/lookup/unit/${u.id}`} className="flex justify-between py-2 hover:bg-slate-50">
                  <span className="font-bold">{u.name} <span className="ltr inline-block text-xs font-normal text-slate-500">{u.code}</span></span>
                  <span className="text-xs text-slate-500">{u._count.users} עובדים</span>
                </Link>
              </li>
            ))}
          </Group>
          <Group icon={<Package className="size-4" />} title="פריטי קטלוג" count={res.items.length}>
            {res.items.map((i) => (
              <li key={i.id}>
                <Link href={`/warehouse/inventory/${i.id}`} className="flex justify-between gap-2 py-2 hover:bg-slate-50">
                  <span className="font-bold">{i.name} <span className="ltr inline-block font-mono text-xs font-normal text-slate-500">{i.sku}</span></span>
                  <span className="text-xs text-slate-500">{i.availableQty} במחסן · {i.totalQuantity - i.availableQty} מחוץ למחסן</span>
                </Link>
              </li>
            ))}
          </Group>
          <Group icon={<Hash className="size-4" />} title="מספרים סידוריים" count={res.serials.length}>
            {res.serials.map((s) => (
              <li key={s.id}>
                <Link href={`/warehouse/lookup/serial/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:bg-slate-50">
                  <span><span className="ltr inline-block font-mono font-bold">{s.serialNumber}</span> · {s.catalogItem.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">{s.holder?.fullName}<SerialBadge status={s.status} /></span>
                </Link>
              </li>
            ))}
          </Group>
        </div>
      )}
    </>
  );
}
