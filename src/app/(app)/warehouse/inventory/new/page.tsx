import { PackagePlus } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { createCatalogItem } from "@/app/actions/inventory";
import { PageHeader } from "@/components/ui";
import ActionForm from "@/components/ActionForm";

export const metadata = { title: "פריט חדש" };

export default async function NewItemPage() {
  await requireRole("WAREHOUSE_MANAGER");
  const categories = await db.catalogItem.findMany({ distinct: ["category"], select: { category: true } });
  return (
    <>
      <PageHeader icon={<PackagePlus className="size-5" />} title="פריט קטלוג חדש" subtitle="לאחר היצירה ניתן לקלוט מלאי בכרטיס הפריט" />
      <div className="card max-w-xl">
        <ActionForm action={createCatalogItem} submitLabel="צור פריט">
          <div>
            <label className="label" htmlFor="sku">מק&quot;ט</label>
            <input id="sku" name="sku" required className="input ltr" placeholder="LAP-002" />
          </div>
          <div>
            <label className="label" htmlFor="name">שם הפריט</label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="category">קטגוריה</label>
            <input id="category" name="category" required className="input" list="categories" />
            <datalist id="categories">{categories.map((c) => <option key={c.category} value={c.category} />)}</datalist>
          </div>
          <div>
            <label className="label" htmlFor="description">תיאור (רשות)</label>
            <textarea id="description" name="description" rows={2} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="requiresSerial" className="size-4" />
            פריט מנוהל מספר סידורי (מחשב, טלפון, מכשיר קשר...)
          </label>
        </ActionForm>
      </div>
    </>
  );
}
