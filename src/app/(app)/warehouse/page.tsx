import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { ExportButton } from "@/components/data";
import { db } from "@/lib/db";
import { PageHeader, StatCard, EmptyState, fmtDate } from "@/components/ui";

export const metadata: Metadata = { title: 'לוח בקרה – מרלו"ג' };

const TX_LABELS: Record<string, string> = {
  STOCK_IN: "קליטת מלאי", ALLOCATE: "הקצאה", ISSUE: "מסירה וחתימה", RETURN: "החזרה וזיכוי",
  TRANSFER: "העברה", ADJUST: "תיקון מלאי", REPAIR_OUT: "יציאה לתיקון", REPAIR_IN: "חזרה מתיקון", WRITE_OFF: "גריעה",
};

export default async function WarehouseHome() {
  await requireRole("WAREHOUSE_MANAGER");

  const [items, pendingWarehouse, openSummons, recentTx] = await Promise.all([
    db.catalogItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.equipmentRequest.count({ where: { status: "PENDING_WAREHOUSE" } }),
    db.returnSummons.count({ where: { status: "PENDING_RETURN" } }),
    db.transaction.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        catalogItem: { select: { name: true } },
        toUser: { select: { fullName: true } },
        serial: { select: { serialNumber: true } },
      },
    }),
  ]);

  const totalUnits = items.reduce((s, i) => s + i.totalQuantity, 0);
  const inStock = items.reduce((s, i) => s + i.availableQty, 0);
  // מלאי נמוך: פחות מ-20% מהכמות הכוללת זמינה במחסן
  const lowStock = items.filter((i) => i.totalQuantity > 0 && i.availableQty / i.totalQuantity < 0.2);

  return (
    <>
      <PageHeader
        title='לוח בקרה – מרלו"ג'
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/warehouse/lookup" className="btn-secondary"><Search className="size-4" /> איתור</Link>
            <Link href="/warehouse/inventory/new" className="btn-secondary"><Plus className="size-4" /> פריט חדש</Link>
            <Link href="/warehouse/users" className="btn-secondary"><Users className="size-4" /> משתמשים</Link>
            <ExportButton report="inventory" label="דוח מלאי" />
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="פריטי קטלוג" value={items.length} />
        <StatCard label="יחידות במחסן" value={inStock} hint={`מתוך ${totalUnits} בארגון`} />
        <StatCard label="דרישות ממתינות להקצאה" value={pendingWarehouse} />
        <StatCard label="זימוני החזרה פתוחים" value={openSummons} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-bold">מצב מלאי לפי פריט</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-right text-slate-500">
                <tr><th className="py-2">פריט</th><th>סוג</th><th>במחסן</th><th>משויך</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <Link href={`/warehouse/inventory/${i.id}`} className="font-bold text-brand-700 hover:underline">{i.name}</Link>
                      <p className="ltr text-right font-mono text-xs text-slate-500">{i.sku}</p>
                    </td>
                    <td>{i.requiresSerial ? "סידורי" : "כמותי"}</td>
                    <td className={lowStock.includes(i) ? "font-bold text-red-600" : ""}>{i.availableQty}</td>
                    <td>{i.totalQuantity - i.availableQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 font-bold">תנועות אחרונות</h2>
          {recentTx.length === 0 ? (
            <EmptyState text="אין תנועות" />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recentTx.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 py-2">
                  <span>
                    <span className="font-bold">{TX_LABELS[t.type]}</span> · {t.catalogItem.name}
                    {t.serial && <span className="ltr mx-1 inline-block font-mono text-xs">{t.serial.serialNumber}</span>}
                    {t.toUser && <> ← {t.toUser.fullName}</>}
                    {!t.serial && t.quantity > 1 && <> ({t.quantity})</>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{fmtDate(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
