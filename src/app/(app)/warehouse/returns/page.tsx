import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAssignments } from "@/lib/reports";
import { cancelSummonsAction, receiveReturnAction } from "@/app/actions/returns";
import { PageHeader, EmptyState, fmtDate, fmtDateTime } from "@/components/ui";
import ActionForm from "@/components/ActionForm";
import SignatureField from "@/components/SignatureField";
import ScanButton from "@/components/ScanButton";

export const metadata: Metadata = { title: "החזרות וזימונים" };

export default async function WarehouseReturnsPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { user: userParam } = await searchParams;

  const [summons, holders, recentCredits] = await Promise.all([
    db.returnSummons.findMany({
      where: { status: "PENDING_RETURN" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, fullName: true, employeeNumber: true, unit: { select: { name: true } } } },
        catalogItem: { select: { name: true, sku: true } },
        serial: { select: { serialNumber: true } },
      },
    }),
    // עובדים שרשום עליהם ציוד – לבחירה בקליטת החזרה
    db.user.findMany({
      where: { OR: [{ serialItems: { some: {} } }, { quantityHoldings: { some: { quantity: { gt: 0 } } } }] },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, employeeNumber: true, unit: { select: { name: true } } },
    }),
    db.signature.findMany({ where: { kind: "RETURN" }, orderBy: { signedAt: "desc" }, take: 8, select: { id: true, signedAt: true, documentJson: true } }),
  ]);

  const selected = holders.find((h) => h.id === userParam);
  const rows = selected ? await getAssignments({ userId: selected.id }) : [];
  const summonedSerials = new Set(summons.filter((s) => s.serialId).map((s) => s.serialId));
  const now = new Date();

  return (
    <>
      <PageHeader title="החזרות וזימונים" subtitle="זימון עובדים להחזרה, קליטת ציוד למלאי והפקת טופס זיכוי חתום" />

      <section className="card mb-8">
        <h2 className="mb-3 font-bold">קליטת החזרה</h2>
        <form className="mb-4 flex flex-wrap gap-2">
          <select name="user" defaultValue={selected?.id ?? ""} aria-label="בחירת עובד" className="input max-w-sm">
            <option value="" disabled>בחר עובד שמחזיר ציוד</option>
            {holders.map((h) => <option key={h.id} value={h.id}>{h.fullName} ({h.employeeNumber}) · {h.unit.name}</option>)}
          </select>
          <button className="btn-secondary">הצג ציוד</button>
        </form>

        {selected && (
          rows.length === 0 ? <EmptyState text="אין ציוד רשום על העובד" /> : (
            <ActionForm action={receiveReturnAction} submitLabel="קליטה למלאי והפקת טופס זיכוי" pendingLabel="קולט..." buttonClassName="btn-accent w-full sm:w-auto">
              <input type="hidden" name="userId" value={selected.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">סמנו את הפריטים שהוחזרו. פריט פגום יועבר לתיקון (סידורי) או ייגרע (כמותי).</p>
                <ScanButton mode="check" label="סריקת פריטים" />
              </div>
              <div className="overflow-x-auto">
                <table className="table-base min-w-[560px]">
                  <thead><tr><th>מוחזר</th><th>פריט</th><th>מספר סידורי / כמות</th><th>סטטוס</th><th>פגום</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const key = r.kind === "SERIAL" ? `s:${r.serialId}` : `q:${r.catalogItemId}`;
                      const pendingAck = r.serialStatus === "PENDING_ACK";
                      return (
                        <tr key={key}>
                          <td>
                            {r.kind === "SERIAL" ? (
                              <input type="checkbox" name="ret" value={key} data-scan={r.serialNumber ?? undefined} disabled={pendingAck}
                                aria-label={`החזרת ${r.serialNumber}`} className="size-5" />
                            ) : <span className="text-xs text-slate-500">כמות ←</span>}
                          </td>
                          <td>{r.itemName}<span className="ltr block font-mono text-xs text-slate-500">{r.sku}</span></td>
                          <td>
                            {r.kind === "SERIAL" ? (
                              <span className="ltr inline-block font-mono">{r.serialNumber}</span>
                            ) : (
                              <input name={`qty:${r.catalogItemId}`} type="number" min={0} max={r.quantity} defaultValue={0}
                                aria-label={`כמות מוחזרת של ${r.itemName}`} className="input min-h-9 w-24" />
                            )}
                            {r.kind === "QUANTITY" && <span className="mr-2 text-xs text-slate-500">מתוך {r.quantity}</span>}
                          </td>
                          <td className="text-xs">
                            {r.status}
                            {r.serialId && summonedSerials.has(r.serialId) && <span className="badge mr-1 bg-red-100 text-red-800">זומן</span>}
                          </td>
                          <td><input type="checkbox" name={`dmg:${key}`} aria-label="פגום" className="size-5 accent-red-700" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="max-w-md">
                <p className="label">חתימת המרלו&quot;ג על קליטת הציוד</p>
                <SignatureField />
              </div>
            </ActionForm>
          )
        )}
      </section>

      <h2 className="mb-3 flex items-center gap-2 font-bold">זימונים פתוחים <span className="badge bg-red-100 text-red-800">{summons.length}</span></h2>
      <section className="mb-8">
        {summons.length === 0 ? <EmptyState text="אין זימונים פתוחים. זימון נוצר מתיק העובד (איתור מהיר)." /> : (
          <ul className="space-y-2">
            {summons.map((s) => {
              const overdue = s.dueDate && s.dueDate < now;
              return (
                <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {s.catalogItem.name}{" "}
                      {s.serial ? <span className="ltr inline-block font-mono text-sm">{s.serial.serialNumber}</span> : <span className="text-sm font-normal">× {s.quantity}</span>}
                    </p>
                    <p className="text-sm text-slate-700">
                      <Link className="link" href={`/warehouse/lookup/user/${s.user.id}`}>{s.user.fullName}</Link> · {s.user.unit.name} · {s.reason}
                    </p>
                    {s.dueDate && (
                      <p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "font-bold text-red-700" : "text-slate-600"}`}>
                        <AlarmClock className="size-3.5" aria-hidden /> עד {fmtDate(s.dueDate)}{overdue && " · באיחור"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/warehouse/returns?user=${s.user.id}`} className="btn-accent min-h-9 text-xs">לקליטה</Link>
                    <ActionForm action={cancelSummonsAction} submitLabel="ביטול" buttonClassName="btn-secondary min-h-9 text-xs" className="contents" confirmText="לבטל את הזימון?">
                      <input type="hidden" name="summonsId" value={s.id} />
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <h2 className="mb-3 font-bold">טופסי זיכוי אחרונים</h2>
      <section className="card">
        {recentCredits.length === 0 ? <EmptyState text="אין" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recentCredits.map((c) => {
              const d = JSON.parse(c.documentJson) as { lines: { employeeName: string }[] };
              return (
                <li key={c.id} className="flex justify-between gap-2 py-2">
                  <Link className="link" href={`/receipts/${c.id}`}>{d.lines[0]?.employeeName} · {d.lines.length} פריטים</Link>
                  <span className="text-xs text-slate-500">{fmtDateTime(c.signedAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
