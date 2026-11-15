import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, ShieldAlert, FileCheck2 } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { DOC_TITLES, verifyDocument, type GenericDoc, type ReceiptDoc } from "@/lib/receipt";
import { PageHeader, fmtDateTime } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "מסמך חתום" };

type Row = { employeeName?: string; employeeNumber?: string; sku: string; name: string; serialNumber: string | null; quantity: number; condition?: string | null };

const SUCCESS: Record<string, string> = {
  RECEIPT: "החתימה נקלטה. הציוד נרשם על שמך, וקבלה נשלחה למייל ולנייד (אם הוגדרו).",
  RETURN: "ההחזרה נקלטה וטופס הזיכוי נשלח לעובד.",
  BULK_TRANSFER: "החלוקה נרשמה. כל עובד יקבל בקשה לאשר את הציוד; עד האישור הוא באחריותך.",
  BULK_COLLECT: "הציוד נאסף ונרשם עליך. העובדים זוכו וקיבלו טופס זיכוי.",
  ACK: "אישרת את קבלת הציוד. מעתה הוא רשום עליך.",
  ISSUE: "הניפוק נרשם. הציוד רשום על המקבל, והקבלה נשלחה אליו (אם הוגדר מייל/SMS).",
};

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireRole();
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const sig = await db.signature.findUnique({ where: { id }, include: { signer: { select: { id: true, unitId: true } } } });
  if (!sig) notFound();

  const parsed = JSON.parse(sig.documentJson) as ReceiptDoc | GenericDoc;
  const isReceipt = parsed.type === "RECEIPT";
  const rows: Row[] = isReceipt ? (parsed as ReceiptDoc).items : (parsed as GenericDoc).lines;
  const employeeIds = isReceipt ? [(parsed as ReceiptDoc).employee.id] : [...new Set((parsed as GenericDoc).lines.map((l) => l.employeeId))];

  // הרשאה: החותם, עובד שמופיע במסמך, מנהל המרלו"ג, או מנהל יחידה של החותם/של עובד במסמך
  let allowed = sig.signerId === user.id || employeeIds.includes(user.id) || user.role === "WAREHOUSE_MANAGER" || user.role === "ADMIN";
  if (!allowed && user.role === "UNIT_MANAGER") {
    allowed = sig.signer.unitId === user.unitId || (await db.user.count({ where: { id: { in: employeeIds }, unitId: user.unitId } })) > 0;
  }
  if (!allowed) notFound();

  const valid = verifyDocument(sig.documentJson, sig.documentHash);
  const multiEmployee = !isReceipt && employeeIds.length > 1;
  const showCondition = !isReceipt && rows.some((r) => r.condition);

  return (
    <>
      {isNew && (
        <p role="status" className="feedback-enter mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-900 print:hidden">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {SUCCESS[parsed.type]}
        </p>
      )}
      <PageHeader icon={<FileCheck2 className="size-5" />} title={DOC_TITLES[parsed.type]} subtitle={`מספר מסמך ${sig.id.slice(0, 8).toUpperCase()}`} actions={<PrintButton />} />

      <article className="card mx-auto max-w-2xl space-y-5 print:border-0 print:p-0">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {isReceipt ? (
            <>
              <div><dt className="text-slate-500">עובד</dt><dd className="font-bold">{(parsed as ReceiptDoc).employee.fullName} ({(parsed as ReceiptDoc).employee.employeeNumber})</dd></div>
              <div><dt className="text-slate-500">יחידה</dt><dd className="font-bold">{(parsed as ReceiptDoc).employee.unit}</dd></div>
              <div><dt className="text-slate-500">הוקצה ע&quot;י</dt><dd className="font-bold">{(parsed as ReceiptDoc).issuedBy}</dd></div>
            </>
          ) : (
            <>
              <div><dt className="text-slate-500">חתם/ה</dt><dd className="font-bold">{(parsed as GenericDoc).signer.fullName} · {(parsed as GenericDoc).signer.role}</dd></div>
              {(parsed as GenericDoc).unit && <div><dt className="text-slate-500">יחידה</dt><dd className="font-bold">{(parsed as GenericDoc).unit}</dd></div>}
              {!multiEmployee && rows[0]?.employeeName && (
                <div><dt className="text-slate-500">עובד</dt><dd className="font-bold">{rows[0].employeeName} ({rows[0].employeeNumber})</dd></div>
              )}
            </>
          )}
          <div><dt className="text-slate-500">מועד חתימה</dt><dd className="font-bold">{fmtDateTime(new Date(parsed.signedAt))}</dd></div>
        </dl>

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                {multiEmployee && <th>עובד</th>}
                <th>פריט</th><th>מספר סידורי</th><th>כמות</th>
                {showCondition && <th>מצב</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>
                  {multiEmployee && <td>{r.employeeName} <span className="text-xs text-slate-500">({r.employeeNumber})</span></td>}
                  <td>{r.name}<span className="ltr block font-mono text-xs text-slate-500">{r.sku}</span></td>
                  <td className="ltr font-mono">{r.serialNumber ?? "—"}</td>
                  <td>{r.quantity}</td>
                  {showCondition && <td>{r.condition}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{parsed.terms}</p>

        <div>
          <p className="mb-1 text-sm text-slate-500">חתימה</p>
          {sig.imageData ? (
            // eslint-disable-next-line @next/next/no-img-element -- Data URL מאומת (PNG) – next/image לא מתאים
            <img src={sig.imageData} alt="חתימה" className="h-32 w-auto max-w-full rounded-lg border border-slate-200 bg-white" />
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
        <Link className="link" href={user.role === "ADMIN" ? "/admin" : user.role === "WAREHOUSE_MANAGER" ? "/warehouse" : user.role === "UNIT_MANAGER" ? "/manager" : "/employee"}>חזרה</Link>
      </p>
    </>
  );
}
