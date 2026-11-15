import type { Metadata } from "next";
import Link from "next/link";
import { createElement } from "react";
import { Tags } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { createCategory, deleteCategory, updateCategory } from "@/app/actions/categories";
import { CATEGORY_ICONS } from "@/components/ItemIcon";
import { PageHeader, EmptyState } from "@/components/ui";
import ActionForm from "@/components/ActionForm";

export const metadata: Metadata = { title: "קטגוריות" };

function IconSelect({ name, defaultValue, id }: { name: string; defaultValue?: string | null; id: string }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? "package"} className="input min-h-9 py-1 text-sm" aria-label="אייקון">
      {Object.entries(CATEGORY_ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </select>
  );
}

export default async function CategoriesPage() {
  await requireRole("WAREHOUSE_MANAGER");
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <>
      <PageHeader icon={<Tags className="size-5" />} title="קטגוריות פריטים" subtitle="קבוצות לסינון, לדוחות ולבחירת פריטים בבקשות. שינוי שם מתעדכן בכל הפריטים." />

      <section className="card mb-6 max-w-2xl">
        <h2 className="mb-3 font-bold">קטגוריה חדשה</h2>
        <ActionForm action={createCategory} submitLabel="הוספה" resetOnSuccess className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="new-name">שם</label>
            <input id="new-name" name="name" required maxLength={40} className="input" placeholder="לדוגמה: כלי עבודה" />
          </div>
          <div>
            <label className="label" htmlFor="new-icon">אייקון</label>
            <IconSelect id="new-icon" name="icon" />
          </div>
        </ActionForm>
      </section>

      {categories.length === 0 ? <EmptyState text="אין קטגוריות" /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id} className="card">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700" aria-hidden>
                  {createElement((CATEGORY_ICONS[c.icon ?? "package"] ?? CATEGORY_ICONS.package).icon, { className: "size-5", strokeWidth: 1.75 })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{c.name}</p>
                  <Link className="link text-xs" href={`/warehouse/inventory?category=${encodeURIComponent(c.name)}`}>{c._count.items} פריטים</Link>
                </div>
                {c._count.items === 0 && (
                  <ActionForm action={deleteCategory} submitLabel="מחיקה" buttonClassName="btn-danger min-h-9 px-2.5 text-xs" className="contents" confirmText={`למחוק את הקטגוריה "${c.name}"?`}>
                    <input type="hidden" name="id" value={c.id} />
                  </ActionForm>
                )}
              </div>
              <ActionForm action={updateCategory} submitLabel="שמירה" buttonClassName="btn-secondary min-h-9 text-xs" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} required maxLength={40} aria-label={`שם הקטגוריה ${c.name}`} className="input min-h-9 min-w-36 flex-1 py-1 text-sm" />
                <IconSelect id={`icon-${c.id}`} name="icon" defaultValue={c.icon} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
