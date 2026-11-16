import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { defaultPickupLocal } from "@/lib/time";
import { allocate, rejectByWarehouse, release } from "@/app/actions/requests";
import { PageHeader, EmptyState } from "@/components/ui";
import { RequestCard } from "@/components/RequestCard";
import ActionForm from "@/components/ActionForm";
import PickupSlotPicker from "@/components/PickupSlotPicker";

export const metadata: Metadata = { title: "דרישות" };

const include = {
  catalogItem: { select: { id: true, name: true, sku: true, requiresSerial: true, availableQty: true } },
  requester: { select: { fullName: true, employeeNumber: true, unit: { select: { name: true } } } },
  allocatedSerials: { select: { serialNumber: true }, orderBy: { serialNumber: "asc" as const } },
} as const;

export default async function WarehouseRequestsPage() {
  await requireRole("WAREHOUSE_MANAGER");
  const [pending, allocated, recent] = await Promise.all([
    db.equipmentRequest.findMany({ where: { status: "PENDING_WAREHOUSE" }, orderBy: { createdAt: "asc" }, include }),
    db.equipmentRequest.findMany({ where: { status: "ALLOCATED" }, orderBy: { pickupDate: "asc" }, include }),
    db.equipmentRequest.findMany({
      where: { status: { in: ["FULFILLED", "REJECTED_WAREHOUSE"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { ...include, transactions: { where: { signatureId: { not: null } }, select: { signatureId: true }, take: 1 } },
    }),
  ]);

  // סידוריים זמינים לכל פריט סידורי שמופיע בתור
  const serialItemIds = [...new Set(pending.filter((r) => r.catalogItem.requiresSerial).map((r) => r.catalogItem.id))];
  const inStock = await db.inventorySerial.findMany({
    where: { catalogItemId: { in: serialItemIds }, status: "IN_STOCK" },
    orderBy: { serialNumber: "asc" },
    select: { id: true, serialNumber: true, catalogItemId: true },
  });

  // ברירת מחדל למועד ידני: מחר 09:00 שעון ישראל; משבצות תפוסות = הקצאות פתוחות
  const tomorrow = defaultPickupLocal();
  const nowIso = new Date().toISOString();
  const taken = allocated.flatMap((r) => (r.pickupDate ? [r.pickupDate.toISOString()] : []));

  return (
    <>
      <PageHeader icon={<ClipboardList className="size-5" />} title="דרישות מאושרות" subtitle="הקצאת ציוד, קביעת מועד איסוף ומעקב אחר חתימות" />

      <h2 className="mb-3 flex items-center gap-2 font-bold">ממתינות להקצאה <span className="badge bg-sky-100 text-sky-900">{pending.length}</span></h2>
      <section className="mb-8 space-y-3">
        {pending.length === 0 && <EmptyState text="אין דרישות ממתינות" />}
        {pending.map((r) => {
          const options = inStock.filter((s) => s.catalogItemId === r.catalogItem.id);
          const short = r.catalogItem.requiresSerial ? options.length < r.quantity : r.catalogItem.availableQty < r.quantity;
          return (
            <RequestCard key={r.id} r={r} showRequester>
              {short && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                  אין מספיק מלאי במחסן ({r.catalogItem.requiresSerial ? options.length : r.catalogItem.availableQty} זמינים).{" "}
                  <Link className="link" href={`/warehouse/inventory/${r.catalogItem.id}`}>לקליטת מלאי</Link>
                </p>
              )}
              <ActionForm action={allocate} submitLabel="הקצאה ועדכון העובד" buttonClassName="btn-accent">
                <input type="hidden" name="requestId" value={r.id} />
                {r.catalogItem.requiresSerial && (
                  <fieldset>
                    <legend className="label">בחר {r.quantity} מספרים סידוריים</legend>
                    <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-3">
                      {options.map((s) => (
                        <label key={s.id} className="flex min-h-9 items-center gap-2 rounded px-1 text-sm hover:bg-slate-50">
                          <input type="checkbox" name="serialIds" value={s.id} className="size-4" />
                          <span className="ltr font-mono">{s.serialNumber}</span>
                        </label>
                      ))}
                      {options.length === 0 && <span className="text-sm text-slate-500">אין פריטים במחסן</span>}
                    </div>
                  </fieldset>
                )}
                <PickupSlotPicker id={`pickup-${r.id}`} taken={taken} now={nowIso} fallbackLocal={tomorrow} />
                <div>
                  <label className="label" htmlFor={`note-${r.id}`}>הערה לעובד (רשות)</label>
                  <input id={`note-${r.id}`} name="note" maxLength={300} className="input" placeholder="למשל: עמדה 3" />
                </div>
              </ActionForm>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-bold text-red-700">דחיית הדרישה</summary>
                <ActionForm action={rejectByWarehouse} submitLabel="דחייה" buttonClassName="btn-danger" className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <input name="note" required placeholder="סיבה (חובה)" aria-label="סיבת דחייה" className="input max-w-xs flex-1" maxLength={300} />
                </ActionForm>
              </details>
            </RequestCard>
          );
        })}
      </section>

      <h2 className="mb-3 flex items-center gap-2 font-bold">הוקצו – ממתינות לחתימת העובד <span className="badge bg-violet-100 text-violet-900">{allocated.length}</span></h2>
      <section className="mb-8 space-y-3">
        {allocated.length === 0 && <EmptyState text="אין הקצאות פתוחות" />}
        {allocated.map((r) => (
          <RequestCard key={r.id} r={r} showRequester>
            {r.allocatedSerials.length > 0 && (
              <p className="mb-2 text-sm">מספרים סידוריים: <span className="ltr inline-block font-mono">{r.allocatedSerials.map((s) => s.serialNumber).join(", ")}</span></p>
            )}
            <ActionForm action={release} submitLabel="שחרור ההקצאה" buttonClassName="btn-secondary min-h-9 text-xs" className="flex flex-wrap items-end gap-2"
              confirmText="לשחרר את ההקצאה? הציוד יחזור למלאי והבקשה תחזור לתור.">
              <input type="hidden" name="requestId" value={r.id} />
              <input name="note" placeholder="סיבה (רשות)" aria-label="סיבת שחרור" className="input min-h-9 max-w-xs flex-1 text-sm" maxLength={300} />
            </ActionForm>
          </RequestCard>
        ))}
      </section>

      <h2 className="mb-3 font-bold">נסגרו לאחרונה</h2>
      <section className="space-y-3">
        {recent.length === 0 && <EmptyState text="אין" />}
        {recent.map((r) => (
          <RequestCard key={r.id} r={r} showRequester>
            {r.transactions[0]?.signatureId && <Link className="link text-sm" href={`/receipts/${r.transactions[0].signatureId}`}>לקבלה החתומה</Link>}
          </RequestCard>
        ))}
      </section>
    </>
  );
}
