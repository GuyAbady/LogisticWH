import { Package } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getHistory, getItemLocation } from "@/lib/reports";
import { allowedSerialTransitions } from "@/lib/inventory";
import { adjustStock, receiveStock, setSerialStatus, updateCatalogItem } from "@/app/actions/inventory";
import { PageHeader, StatCard, SerialBadge, EmptyState } from "@/components/ui";
import { AssignmentTable, ExportButton, HistoryList } from "@/components/data";
import ActionForm from "@/components/ActionForm";
import ScanButton from "@/components/ScanButton";

export const metadata = { title: "כרטיס פריט" };

const TRANSITION_LABEL = { IN_REPAIR: "לתיקון", IN_STOCK: "חזר מתיקון", WRITTEN_OFF: "גריעה" } as const;

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { id } = await params;
  const { status: rawStatus } = await searchParams;
  // רק ערכים מותרים מה-URL (ערך לא חוקי היה מפיל את שאילתת Prisma)
  const status = (["IN_STOCK", "SIGNED", "IN_REPAIR", "WRITTEN_OFF"] as const).find((v) => v === rawStatus);
  const loc = await getItemLocation(id);
  if (!loc) notFound();
  const { item } = loc;

  const [serials, history, categories] = await Promise.all([
    item.requiresSerial
      ? db.inventorySerial.findMany({
          where: { catalogItemId: id, ...(status ? { status } : { status: { not: "WRITTEN_OFF" } }) },
          include: { holder: { select: { id: true, fullName: true } } },
          orderBy: { serialNumber: "asc" },
          take: 300,
        })
      : Promise.resolve([]),
    getHistory({ catalogItemId: id }, 50),
    db.category.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return (
    <>
      <PageHeader
        icon={<Package className="size-5" />}
        title={item.name}
        subtitle={`מק"ט ${item.sku} · ${item.category} · ${item.requiresSerial ? "מנוהל מספר סידורי" : "פריט כמותי"}`}
        actions={<ExportButton report="item" id={item.id} label="ייצוא איתור" />}
      />

      <details className="card mb-6">
        <summary className="cursor-pointer font-bold">עריכת פרטי הפריט</summary>
        <ActionForm action={updateCatalogItem} submitLabel="שמירת שינויים" className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={item.id} />
          <div><label className="label" htmlFor="edit-name">שם הפריט</label><input id="edit-name" name="name" defaultValue={item.name} required className="input" /></div>
          <div>
            <label className="label" htmlFor="edit-category">קטגוריה</label>
            <select id="edit-category" name="category" defaultValue={item.category} className="input">
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label" htmlFor="edit-desc">תיאור</label><textarea id="edit-desc" name="description" defaultValue={item.description ?? ""} rows={2} className="input" /></div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="isActive" defaultChecked={item.isActive} className="size-5" /> פריט פעיל (מוצג בבקשות ובניפוק)
          </label>
          <p className="text-xs text-slate-600 sm:col-span-2">מק&quot;ט וסוג הפריט (סידורי/כמותי) אינם ניתנים לשינוי – הם משפיעים על נתונים קיימים.</p>
        </ActionForm>
      </details>

      {/* היכן הפריט נמצא */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="סה״כ בארגון" value={item.totalQuantity} />
        <StatCard label="במחסן (זמין)" value={loc.inStock} />
        <StatCard label="משויך לעובדים" value={loc.assigned} />
        <StatCard label="בתיקון" value={loc.inRepair} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-bold">פילוח לפי יחידה</h2>
          {loc.byUnit.length === 0 ? <EmptyState text="הפריט אינו משויך לאף יחידה" /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {loc.byUnit.map((u) => (
                <li key={u.unitId} className="flex justify-between py-2">
                  <Link href={`/warehouse/lookup/unit/${u.unitId}`} className="link">{u.unitName}</Link>
                  <span className="font-bold">{u.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-bold">קליטת מלאי</h2>
          <ActionForm action={receiveStock} submitLabel="קלוט למלאי" resetOnSuccess buttonClassName="btn-accent">
            <input type="hidden" name="catalogItemId" value={item.id} />
            {item.requiresSerial ? (
              <div>
                <div className="mb-1.5 flex items-end justify-between gap-2">
                  <label className="label mb-0" htmlFor="serials">מספרים סידוריים</label>
                  <ScanButton targetId="serials" mode="append" label="סריקה רציפה" />
                </div>
                <textarea id="serials" name="serials" rows={4} required className="input ltr font-mono" placeholder={"DL-2001\nDL-2002"} />
                <p className="mt-1 text-xs text-slate-500">מספר בכל שורה (או מופרדים בפסיק). עד 500 בפעולה.</p>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="quantity">כמות</label>
                <input id="quantity" name="quantity" type="number" min={1} max={100000} required className="input" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="note">הערה / תעודת משלוח (רשות)</label>
              <input id="note" name="note" className="input" maxLength={300} />
            </div>
          </ActionForm>
        </section>
      </div>

      {!item.requiresSerial && (
        <section className="card mb-6">
          <h2 className="mb-2 font-bold">תיקון מלאי / גריעה</h2>
          <ActionForm action={adjustStock} submitLabel="עדכן מלאי" resetOnSuccess confirmText="לאשר את תיקון המלאי? הפעולה תירשם ביומן ולא ניתנת למחיקה."
            className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
            <input type="hidden" name="catalogItemId" value={item.id} />
            <div>
              <label className="label" htmlFor="delta">שינוי (+/-)</label>
              <input id="delta" name="delta" type="number" required className="input ltr" placeholder="-2" />
            </div>
            <div>
              <label className="label" htmlFor="type">סוג</label>
              <select id="type" name="type" className="input"><option value="ADJUST">תיקון ספירה</option><option value="WRITE_OFF">גריעה (בלאי/אובדן)</option></select>
            </div>
            <div>
              <label className="label" htmlFor="adjnote">סיבה (חובה)</label>
              <input id="adjnote" name="note" required className="input" maxLength={300} />
            </div>
          </ActionForm>
        </section>
      )}

      {item.requiresSerial && (
        <section className="card mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">מספרים סידוריים ({serials.length})</h2>
            <form className="flex gap-2">
              <select name="status" defaultValue={status ?? ""} className="input py-1.5 text-sm">
                <option value="">פעילים (ללא נגרעים)</option>
                <option value="IN_STOCK">במחסן</option>
                <option value="SIGNED">חתומים</option>
                <option value="IN_REPAIR">בתיקון</option>
                <option value="WRITTEN_OFF">נגרעים</option>
              </select>
              <button className="btn-secondary py-1.5">סינון</button>
            </form>
          </div>
          {serials.length === 0 ? <EmptyState text="אין מספרים סידוריים" /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {serials.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2">
                    <Link href={`/warehouse/lookup/serial/${s.id}`} className="ltr inline-block font-mono link">{s.serialNumber}</Link>
                    <SerialBadge status={s.status} />
                    {s.holder && <Link href={`/warehouse/lookup/user/${s.holder.id}`} className="text-slate-600 hover:underline">{s.holder.fullName}</Link>}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {allowedSerialTransitions(s.status).map((t) =>
                      t.to === "WRITTEN_OFF" ? (
                        // גריעה היא פעולה סופית: שדה הסיבה נפתח רק כשבוחרים בה (Progressive disclosure)
                        <details key={t.to} className="group">
                          <summary className="btn-danger min-h-9 list-none px-2.5 text-xs">גריעה</summary>
                          <ActionForm action={setSerialStatus} submitLabel="אשר גריעה" className="mt-2 flex items-center gap-1"
                            buttonClassName="btn-danger min-h-9 px-2.5 text-xs" confirmText={`לגרוע את ${s.serialNumber}? פעולה סופית.`}>
                            <input type="hidden" name="serialId" value={s.id} />
                            <input type="hidden" name="to" value={t.to} />
                            <input name="note" required placeholder="סיבת גריעה" aria-label="סיבת גריעה" className="input min-h-9 w-32 px-2 py-1 text-xs" />
                          </ActionForm>
                        </details>
                      ) : (
                        <ActionForm key={t.to} action={setSerialStatus} submitLabel={TRANSITION_LABEL[t.to as keyof typeof TRANSITION_LABEL]}
                          className="flex items-center gap-1" buttonClassName="btn-secondary min-h-9 px-2.5 text-xs">
                          <input type="hidden" name="serialId" value={s.id} />
                          <input type="hidden" name="to" value={t.to} />
                        </ActionForm>
                      ),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card mb-6">
        <h2 className="mb-3 font-bold">היכן הפריט נמצא – שיוכים לעובדים</h2>
        <AssignmentTable rows={loc.assignments} show={{ unit: true, user: true }} />
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">תנועות אחרונות (50)</h2>
        <HistoryList items={history} showItem={false} />
      </section>
    </>
  );
}
