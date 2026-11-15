import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { DOC_TITLES } from "@/lib/receipt";
import { PageHeader, EmptyState, fmtDate, fmtDateTime } from "@/components/ui";

export const metadata: Metadata = { title: "החזרות וזיכויים" };

export default async function MyReturnsPage() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const [summons, creditTx] = await Promise.all([
    db.returnSummons.findMany({
      where: { userId: user.id, status: "PENDING_RETURN" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: { catalogItem: { select: { name: true } }, serial: { select: { serialNumber: true } } },
    }),
    // מסמכי זיכוי: החזרה למרלו"ג או איסוף ע"י מנהל היחידה
    db.transaction.findMany({
      where: { fromUserId: user.id, type: { in: ["RETURN", "TRANSFER"] }, signatureId: { not: null } },
      orderBy: { createdAt: "desc" },
      distinct: ["signatureId"],
      take: 20,
      select: { signatureId: true, createdAt: true, signature: { select: { documentJson: true } } },
    }),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader title="החזרות וזיכויים" subtitle='זימונים להחזרת ציוד וטופסי זיכוי שהופקו עבורך' />

      <h2 className="mb-3 font-bold">זימונים להחזרה</h2>
      <section className="mb-8 space-y-2">
        {summons.length === 0 && <EmptyState text="אין זימונים פתוחים" />}
        {summons.map((s) => {
          const overdue = s.dueDate && s.dueDate < now;
          return (
            <article key={s.id} className={`card ${overdue ? "border-red-300" : ""}`}>
              <p className="font-bold">
                {s.catalogItem.name}{" "}
                {s.serial ? <span className="ltr inline-block font-mono text-sm">{s.serial.serialNumber}</span> : <span className="font-normal">× {s.quantity}</span>}
              </p>
              <p className="text-sm text-slate-700">סיבה: {s.reason}</p>
              {s.dueDate && (
                <p className={`mt-1 flex items-center gap-1 text-sm ${overdue ? "font-bold text-red-700" : "text-slate-700"}`}>
                  <AlarmClock className="size-4" aria-hidden /> להחזיר למרלו&quot;ג עד {fmtDate(s.dueDate)}{overdue && " · באיחור"}
                </p>
              )}
            </article>
          );
        })}
      </section>

      <h2 className="mb-3 font-bold">טופסי זיכוי</h2>
      <section className="card">
        {creditTx.length === 0 ? <EmptyState text="עדיין לא הופקו טופסי זיכוי" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {creditTx.map((t) => {
              const type = (JSON.parse(t.signature!.documentJson) as { type: keyof typeof DOC_TITLES }).type;
              return (
                <li key={t.signatureId} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <Link className="link" href={`/receipts/${t.signatureId}`}>{DOC_TITLES[type]}</Link>
                  <span className="text-xs text-slate-500">{fmtDateTime(t.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
