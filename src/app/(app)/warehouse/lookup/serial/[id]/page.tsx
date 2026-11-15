import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getHistory } from "@/lib/reports";
import { PageHeader, SerialBadge } from "@/components/ui";
import { ExportButton, HistoryList } from "@/components/data";

export const metadata = { title: "היסטוריית מספר סידורי" };

export default async function SerialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { id } = await params;
  const serial = await db.inventorySerial.findUnique({
    where: { id },
    include: { catalogItem: true, holder: { include: { unit: true } } },
  });
  if (!serial) notFound();
  const history = await getHistory({ serialId: id }, 500);

  return (
    <>
      <PageHeader
        title={`מספר סידורי ${serial.serialNumber}`}
        subtitle={`${serial.catalogItem.name} · מק"ט ${serial.catalogItem.sku}`}
        actions={<ExportButton report="serial" id={serial.id} />}
      />
      <section className="card mb-6 grid gap-3 sm:grid-cols-3">
        <div><p className="text-sm text-slate-500">סטטוס</p><SerialBadge status={serial.status} /></div>
        <div>
          <p className="text-sm text-slate-500">מחזיק נוכחי</p>
          {serial.holder ? (
            <Link href={`/warehouse/lookup/user/${serial.holder.id}`} className="font-bold text-brand-700 hover:underline">
              {serial.holder.fullName} · {serial.holder.unit.name}
            </Link>
          ) : <p className="font-bold">מחסן</p>}
        </div>
        <div><p className="text-sm text-slate-500">פריט</p><Link href={`/warehouse/inventory/${serial.catalogItemId}`} className="font-bold text-brand-700 hover:underline">לכרטיס הפריט</Link></div>
      </section>
      <section className="card">
        <h2 className="mb-3 font-bold">היסטוריית החזקה ותנועות</h2>
        <HistoryList items={history} showItem={false} />
      </section>
    </>
  );
}
