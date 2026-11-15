import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import { RequestCard } from "@/components/RequestCard";
import ActionForm from "@/components/ActionForm";
import SignatureField from "@/components/SignatureField";
import { acknowledgeAction, rejectTransferAction } from "@/app/actions/bulk";

export const metadata: Metadata = { title: "ממתין לחתימתי" };

export default async function SignListPage() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const [pending, transfers] = await Promise.all([
    db.equipmentRequest.findMany({
      where: { requesterId: user.id, status: "ALLOCATED" },
      orderBy: { pickupDate: "asc" },
      include: { catalogItem: { select: { name: true, sku: true, requiresSerial: true } } },
    }),
    // העברות ממנהל היחידה שממתינות לאישור – עד האישור האחריות על המנהל
    db.transaction.findMany({
      where: { toUserId: user.id, type: "TRANSFER", requiresAck: true, ackAt: null },
      orderBy: { createdAt: "asc" },
      include: { catalogItem: { select: { name: true, sku: true } }, serial: { select: { serialNumber: true } }, fromUser: { select: { fullName: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="ממתין לחתימתי" subtitle='הקצאות מהמרלו"ג (חתימה בעת האיסוף) וציוד שחולק לך ע"י מנהל היחידה' />
      {transfers.length > 0 && (
        <section className="card mb-6">
          <h2 className="font-bold">ציוד שחולק לך ע&quot;י מנהל היחידה</h2>
          <p className="mb-3 text-sm text-slate-600">עד לאישורך הציוד באחריות מנהל היחידה. סמנו את הפריטים שקיבלתם בפועל וחתמו.</p>
          <ActionForm action={acknowledgeAction} submitLabel="אישור קבלה וחתימה" pendingLabel="שומר..." buttonClassName="btn-accent w-full">
            <ul className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <li key={t.id} className="flex min-h-11 items-center gap-3 py-2">
                  <input type="checkbox" name="ack" value={t.id} defaultChecked className="size-5" aria-label={`אישור ${t.catalogItem.name}`} />
                  <span className="flex-1 text-sm">
                    <b>{t.catalogItem.name}</b>{" "}
                    {t.serial ? <span className="ltr inline-block font-mono">{t.serial.serialNumber}</span> : <>× {t.quantity}</>}
                    <span className="block text-xs text-slate-500">מאת {t.fromUser?.fullName}</span>
                  </span>
                </li>
              ))}
            </ul>
            <SignatureField />
          </ActionForm>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-bold text-red-700">לא קיבלתי פריט – דחייה</summary>
            <div className="mt-2 space-y-2">
              {transfers.map((t) => (
                <ActionForm key={t.id} action={rejectTransferAction} submitLabel="דחייה" buttonClassName="btn-danger min-h-9 text-xs" className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="txId" value={t.id} />
                  <span className="text-sm">{t.catalogItem.name} {t.serial?.serialNumber ?? `× ${t.quantity}`}</span>
                  <input name="note" required placeholder="סיבה" aria-label="סיבת דחייה" className="input min-h-9 max-w-[12rem] flex-1 text-sm" />
                </ActionForm>
              ))}
            </div>
          </details>
        </section>
      )}

      {pending.length === 0 ? (transfers.length === 0 && <EmptyState text="אין ציוד הממתין לחתימה" />) : (
        <div className="space-y-3">
          {pending.map((r) => (
            <RequestCard key={r.id} r={r}>
              <Link href={`/employee/sign/${r.id}`} className="btn-accent">לחתימה</Link>
            </RequestCard>
          ))}
        </div>
      )}
    </>
  );
}
