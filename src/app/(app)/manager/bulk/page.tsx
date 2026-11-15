import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAssignments } from "@/lib/reports";
import { bulkCollectAction, bulkTransferAction } from "@/app/actions/bulk";
import { PageHeader, EmptyState, fmtDateTime } from "@/components/ui";
import ActionForm from "@/components/ActionForm";
import SignatureField from "@/components/SignatureField";

export const metadata: Metadata = { title: "פעולות מרוכזות" };

export default async function BulkPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireRole("UNIT_MANAGER");
  const tab = (await searchParams).tab === "collect" ? "collect" : "distribute";

  // עובדי היחידה בלבד (סינון בשרת), ללא המנהל עצמו
  const employees = await db.user.findMany({
    where: { unitId: me.unitId, isActive: true, NOT: { id: me.id } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, employeeNumber: true },
  });

  const [mySerials, myHoldings, unitRows, awaitingAck] = await Promise.all([
    db.inventorySerial.findMany({ where: { holderId: me.id, status: "SIGNED" }, include: { catalogItem: true }, orderBy: { serialNumber: "asc" } }),
    db.quantityHolding.findMany({ where: { userId: me.id, quantity: { gt: 0 } }, include: { catalogItem: true } }),
    tab === "collect" ? getAssignments({ unitId: me.unitId }) : Promise.resolve([]),
    db.transaction.findMany({
      where: { fromUserId: me.id, type: "TRANSFER", requiresAck: true, ackAt: null },
      orderBy: { createdAt: "desc" },
      include: { toUser: { select: { fullName: true } }, catalogItem: { select: { name: true } }, serial: { select: { serialNumber: true } } },
    }),
  ]);
  const collectable = unitRows.filter(
    (r) => r.userId !== me.id && (r.kind === "SERIAL" ? r.serialStatus === "SIGNED" || r.serialStatus === "PENDING_RETURN" : r.quantity > 0),
  );

  const tabCls = (t: string) => `flex min-h-11 items-center rounded-lg px-4 text-sm font-bold ${tab === t ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <>
      <PageHeader title="פעולות מרוכזות" subtitle={`${me.unit.name} · ${employees.length} עובדים`} />

      <nav className="mb-5 flex gap-2" aria-label="סוג פעולה">
        <Link href="/manager/bulk" className={tabCls("distribute")} aria-current={tab === "distribute" ? "page" : undefined}>החתמה מרוכזת (חלוקה)</Link>
        <Link href="/manager/bulk?tab=collect" className={tabCls("collect")} aria-current={tab === "collect" ? "page" : undefined}>זיכוי מרוכז (איסוף)</Link>
      </nav>

      {tab === "distribute" ? (
        <>
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            חלוקת ציוד הרשום עליך לעובדי היחידה בחתימה אחת. כל עובד יתבקש לאשר בנייד; עד האישור הציוד נשאר באחריותך.
          </p>
          {mySerials.length === 0 && myHoldings.length === 0 ? (
            <EmptyState text='אין ציוד רשום עליך לחלוקה. ניתן לבקש ציוד מהמרלו"ג במסך "הבקשות שלי".' />
          ) : (
            <ActionForm action={bulkTransferAction} submitLabel="חתימה וחלוקה" pendingLabel="מחלק..." buttonClassName="btn-accent w-full sm:w-auto">
              {mySerials.length > 0 && (
                <section className="card">
                  <h2 className="mb-2 font-bold">פריטים סידוריים</h2>
                  <ul className="divide-y divide-slate-100">
                    {mySerials.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="text-sm"><b>{s.catalogItem.name}</b> <span className="ltr inline-block font-mono">{s.serialNumber}</span></span>
                        <select name={`ts:${s.id}`} defaultValue="" aria-label={`עובד עבור ${s.serialNumber}`} className="input min-h-9 max-w-[14rem] text-sm">
                          <option value="">— לא לחלק —</option>
                          {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                        </select>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {myHoldings.map((h) => (
                <section key={h.id} className="card">
                  <h2 className="mb-2 font-bold">{h.catalogItem.name} <span className="text-sm font-normal text-slate-600">· ברשותך {h.quantity}</span></h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {employees.map((e) => (
                      <label key={e.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{e.fullName}</span>
                        <input name={`tq:${h.catalogItemId}:${e.id}`} type="number" min={0} max={h.quantity} defaultValue={0} className="input min-h-9 w-20" />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
              <section className="card max-w-md">
                <p className="label">חתימת מנהל היחידה</p>
                <SignatureField />
              </section>
            </ActionForm>
          )}

          <h2 className="mb-3 mt-8 font-bold">ממתינים לאישור עובדים ({awaitingAck.length})</h2>
          {awaitingAck.length === 0 ? <EmptyState text="אין חלוקות שממתינות לאישור" /> : (
            <ul className="card divide-y divide-slate-100 text-sm">
              {awaitingAck.map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{t.toUser?.fullName} · {t.catalogItem.name} {t.serial?.serialNumber ?? `× ${t.quantity}`}</span>
                  <span className="text-xs text-slate-500">{fmtDateTime(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            איסוף ציוד מעובדי היחידה בחתימה אחת: הציוד עובר אליך והעובדים מזוכים ומקבלים טופס זיכוי. משם ניתן להחזירו למרלו&quot;ג.
          </p>
          {collectable.length === 0 ? <EmptyState text="אין ציוד חתום על עובדי היחידה" /> : (
            <ActionForm action={bulkCollectAction} submitLabel="חתימה וזיכוי העובדים" pendingLabel="מזכה..." buttonClassName="btn-accent w-full sm:w-auto"
              confirmText="לאסוף את הפריטים המסומנים ולזכות את העובדים?">
              <section className="card overflow-x-auto">
                <table className="table-base min-w-[560px]">
                  <thead><tr><th>איסוף</th><th>עובד</th><th>פריט</th><th>מספר סידורי / כמות</th></tr></thead>
                  <tbody>
                    {collectable.map((r) => (
                      <tr key={`${r.serialId ?? r.catalogItemId}-${r.userId}`}>
                        <td>
                          {r.kind === "SERIAL" ? (
                            <input type="checkbox" name="cs" value={`${r.serialId}|${r.userId}`} aria-label={`איסוף ${r.serialNumber}`} className="size-5" />
                          ) : <span className="text-xs text-slate-500">כמות ←</span>}
                        </td>
                        <td>{r.userName}</td>
                        <td>{r.itemName}</td>
                        <td>
                          {r.kind === "SERIAL" ? <span className="ltr inline-block font-mono">{r.serialNumber}</span> : (
                            <span className="flex items-center gap-2">
                              <input name={`cq:${r.catalogItemId}:${r.userId}`} type="number" min={0} max={r.quantity} defaultValue={0}
                                aria-label={`כמות לאיסוף של ${r.itemName} מ${r.userName}`} className="input min-h-9 w-20" />
                              <span className="text-xs text-slate-500">מתוך {r.quantity}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="card max-w-md">
                <p className="label">חתימת מנהל היחידה</p>
                <SignatureField />
              </section>
            </ActionForm>
          )}
        </>
      )}
    </>
  );
}
