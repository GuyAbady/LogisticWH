import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { RECEIPT_TERMS } from "@/lib/receipt";
import { submitSignature } from "@/app/actions/requests";
import { PageHeader, fmtDateTime } from "@/components/ui";
import ActionForm from "@/components/ActionForm";
import SignatureField from "@/components/SignatureField";

export const metadata = { title: "חתימה על קבלת ציוד" };

export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const { id } = await params;
  const r = await db.equipmentRequest.findUnique({
    where: { id },
    include: {
      catalogItem: true,
      allocatedSerials: { where: { status: "ALLOCATED" }, orderBy: { serialNumber: "asc" } },
    },
  });
  // רק המבקש עצמו רואה ומחתים – אחרת 404 (לא חושפים קיום בקשה)
  if (!r || r.requesterId !== user.id) notFound();

  if (r.status !== "ALLOCATED") {
    return (
      <>
        <PageHeader title="חתימה על קבלת ציוד" />
        <p className="card text-sm">הבקשה אינה ממתינה לחתימה (ייתכן שכבר נחתמה או שההקצאה שוחררה).</p>
      </>
    );
  }

  const lines = r.catalogItem.requiresSerial
    ? r.allocatedSerials.map((s) => ({ key: s.id, serial: s.serialNumber, qty: 1 }))
    : [{ key: "q", serial: null as string | null, qty: r.quantity }];

  return (
    <>
      <PageHeader title="חתימה על קבלת ציוד" subtitle={`${user.fullName} · מספר עובד ${user.employeeNumber} · ${user.unit.name}`} />
      <div className="mx-auto max-w-xl space-y-4">
        <section className="card">
          <h2 className="mb-2 font-bold">הציוד שהוקצה לך</h2>
          <table className="table-base">
            <thead><tr><th>פריט</th><th>מספר סידורי</th><th>כמות</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{r.catalogItem.name}<span className="ltr block font-mono text-xs text-slate-500">{r.catalogItem.sku}</span></td>
                  <td className="ltr font-mono">{l.serial ?? "—"}</td>
                  <td>{l.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.pickupDate && <p className="mt-3 text-sm text-slate-600">מועד איסוף שנקבע: <b className="text-slate-900">{fmtDateTime(r.pickupDate)}</b></p>}
        </section>

        <section className="card">
          <ActionForm action={submitSignature} submitLabel="חתימה ואישור קבלה" pendingLabel="שומר חתימה..." buttonClassName="btn-accent w-full py-3 text-base">
            <input type="hidden" name="requestId" value={r.id} />
            <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{RECEIPT_TERMS}</p>
            <SignatureField />
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
              <input type="checkbox" name="agree" required className="size-5 accent-[var(--color-accent-600)]" />
              קראתי ואני מאשר/ת את קבלת הציוד
            </label>
          </ActionForm>
          <p className="mt-3 text-xs text-slate-500">
            עם החתימה יישמרו: תמונת החתימה, תוכן המסמך וטביעת אצבע דיגיטלית שלו (SHA-256), מועד, כתובת IP וסוג המכשיר.
          </p>
        </section>
      </div>
    </>
  );
}
