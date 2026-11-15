import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { verifyReceipt, type ReceiptDoc } from "@/lib/receipt";
import { PageHeader, fmtDateTime } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "קבלה דיגיטלית" };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireRole();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const sig = await db.signature.findUnique({ where: { id }, include: { signer: { select: { id: true, unitId: true } } } });
  if (!sig) notFound();

  // הרשאה: החותם, מנהל המרלו"ג, או מנהל היחידה של החותם
  const allowed =
    sig.signerId === user.id ||
    user.role === "WAREHOUSE_MANAGER" ||
    (user.role === "UNIT_MANAGER" && sig.signer.unitId === user.unitId);
  if (!allowed) notFound();

  const doc = JSON.parse(sig.documentJson) as ReceiptDoc;
  const valid = verifyReceipt(sig.documentJson, sig.documentHash);

  return (
    <>
      {isNew && (
        <p role="status" className="feedback-enter mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-900 print:hidden">
          <CheckCircle2 className="size-5" aria-hidden /> החתימה נקלטה. הציוד נרשם על שמך, וקבלה נשלחה למייל ולנייד (אם הוגדרו).
        </p>
      )}
      <PageHeader title="קבלה דיגיטלית על קבלת ציוד" subtitle={`מספר קבלה ${sig.id.slice(0, 8).toUpperCase()}`} actions={<PrintButton />} />

      <article className="card mx-auto max-w-2xl space-y-5 print:border-0 print:p-0">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">עובד</dt><dd className="font-bold">{doc.employee.fullName} ({doc.employee.employeeNumber})</dd></div>
          <div><dt className="text-slate-500">יחידה</dt><dd className="font-bold">{doc.employee.unit}</dd></div>
          <div><dt className="text-slate-500">מועד חתימה</dt><dd className="font-bold">{fmtDateTime(new Date(doc.signedAt))}</dd></div>
          <div><dt className="text-slate-500">הוקצה ע&quot;י</dt><dd className="font-bold">{doc.issuedBy}</dd></div>
        </dl>

        <table className="table-base">
          <thead><tr><th>פריט</th><th>מק&quot;ט</th><th>מספר סידורי</th><th>כמות</th></tr></thead>
          <tbody>
            {doc.items.map((i, n) => (
              <tr key={n}>
                <td>{i.name}</td>
                <td className="ltr font-mono text-xs">{i.sku}</td>
                <td className="ltr font-mono">{i.serialNumber ?? "—"}</td>
                <td>{i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{doc.terms}</p>

        <div>
          <p className="mb-1 text-sm text-slate-500">חתימת העובד</p>
          {sig.imageData ? (
            // eslint-disable-next-line @next/next/no-img-element -- Data URL מאומת (PNG) – next/image לא מתאים
            <img src={sig.imageData} alt={`חתימת ${doc.employee.fullName}`} className="h-32 w-auto max-w-full rounded-lg border border-slate-200 bg-white" />
          ) : (
            <p className="text-sm text-slate-500">(רשומת דוגמה ללא תמונת חתימה)</p>
          )}
        </div>

        <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${valid ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {valid ? <ShieldCheck className="size-4 shrink-0" aria-hidden /> : <ShieldAlert className="size-4 shrink-0" aria-hidden />}
          <div className="min-w-0">
            <p className="font-bold">{valid ? "שלמות המסמך אומתה" : "אזהרה: תוכן המסמך אינו תואם לטביעת האצבע שנשמרה"}</p>
            <p className="ltr mt-1 break-all font-mono">SHA-256: {sig.documentHash}</p>
            {sig.ipAddress && <p className="mt-1">כתובת IP: <span className="ltr inline-block font-mono">{sig.ipAddress}</span></p>}
          </div>
        </div>
      </article>

      <p className="mt-4 text-center text-sm print:hidden">
        <Link className="link" href={user.role === "WAREHOUSE_MANAGER" ? "/warehouse/requests" : "/employee"}>חזרה</Link>
      </p>
    </>
  );
}
