import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import ItemIcon from "@/components/ItemIcon";
import { Legend, SERIES, ThinSegmentedBar } from "@/components/charts";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import { ExportButton } from "@/components/data";

export const metadata: Metadata = { title: "ניהול מלאי" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { q = "", category = "" } = await searchParams;
  const contains = { contains: q.trim(), mode: "insensitive" as const };

  const [items, categories, repair] = await Promise.all([
    db.catalogItem.findMany({
      where: {
        ...(q.trim() ? { OR: [{ sku: contains }, { name: contains }] } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.inventorySerial.groupBy({ by: ["catalogItemId"], where: { status: "IN_REPAIR" }, _count: true }),
  ]);
  const repairMap = new Map(repair.map((r) => [r.catalogItemId, r._count]));

  return (
    <>
      <PageHeader
        icon={<Boxes className="size-5" />}
        title="ניהול מלאי"
        subtitle="קטלוג פריטים, מלאי במחסן ושיוכים"
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportButton report="inventory" label="דוח מלאי" />
            <Link href="/warehouse/inventory/new" className="btn-primary"><Plus className="size-4" /> פריט חדש</Link>
          </div>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder='חיפוש לפי מק"ט או שם' className="input max-w-xs" />
        <select name="category" defaultValue={category} className="input max-w-[12rem]">
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <button className="btn-secondary">סינון</button>
      </form>

      {items.length === 0 ? (
        <EmptyState text="לא נמצאו פריטים" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <Legend items={[{ label: "במחסן", color: SERIES[0] }, { label: "משויך", color: SERIES[1] }, { label: "בתיקון", color: SERIES[2] }]} />
          </div>
          <table className="table-base min-w-[640px]">
            <thead className="bg-slate-50 text-right text-slate-500">
              <tr>
                <th className="p-3">פריט</th><th>קטגוריה</th><th>סוג</th><th className="w-40">פילוח</th><th>סה&quot;כ</th><th>במחסן</th><th>בתיקון</th><th>משויך</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const inRepair = repairMap.get(i.id) ?? 0;
                const low = i.totalQuantity > 0 && i.availableQty / i.totalQuantity < 0.2;
                return (
                  <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <span className="flex items-center gap-3">
                      <ItemIcon name={i.name} category={i.category} size="sm" />
                      <span className="min-w-0">
                      <Link href={`/warehouse/inventory/${i.id}`} className="link">{i.name}</Link>
                      <p className="ltr text-right font-mono text-xs text-slate-500">{i.sku}</p>
                      {!i.isActive && <span className="badge bg-slate-200 text-slate-600">לא פעיל</span>}
                      </span>
                      </span>
                    </td>
                    <td>{i.category}</td>
                    <td>{i.requiresSerial ? "סידורי" : "כמותי"}</td>
                    <td>
                      <ThinSegmentedBar label={i.name} parts={[
                        { name: "במחסן", value: i.availableQty, color: SERIES[0] },
                        { name: "משויך", value: i.totalQuantity - i.availableQty - inRepair, color: SERIES[1] },
                        { name: "בתיקון", value: inRepair, color: SERIES[2] },
                      ]} />
                    </td>
                    <td>{i.totalQuantity}</td>
                    <td className={low ? "font-bold text-red-600" : ""} title={low ? "מלאי נמוך (פחות מ-20%)" : undefined}>{i.availableQty}</td>
                    <td>{inRepair}</td>
                    <td>{i.totalQuantity - i.availableQty - inRepair}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
