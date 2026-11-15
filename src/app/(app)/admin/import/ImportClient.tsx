"use client";

import { startTransition, useActionState } from "react";
import { AlertCircle, CheckCircle2, Download, FileCheck2, KeyRound, Loader2, Upload } from "lucide-react";
import { importUsersAction, type ImportState } from "@/app/actions/import";

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "חדש", cls: "bg-emerald-100 text-emerald-900" },
  update: { label: "עדכון", cls: "bg-sky-100 text-sky-900" },
  unchanged: { label: "ללא שינוי", cls: "bg-slate-100 text-slate-700" },
  error: { label: "שגיאה", cls: "bg-red-100 text-red-800" },
};
const ROLE_HE: Record<string, string> = { EMPLOYEE: "עובד", UNIT_MANAGER: "מנהל יחידה", WAREHOUSE_MANAGER: 'מנהל מרלו"ג' };

export default function ImportClient() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importUsersAction, undefined);
  const plan = state && "plan" in state ? state.plan : undefined;
  const loadable = plan ? plan.counts.new + plan.counts.update : 0;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        // שליחה ידנית: React 19 היה מאפס את בחירת הקובץ אחרי "בדיקה"; FormData(form, submitter) כולל את הכפתור שנלחץ
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "commit" && !window.confirm(`לטעון ${loadable} עובדים למערכת?`)) return;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => action(fd));
      }}
    >
      <section className="card space-y-4">
        <div>
          <label htmlFor="file" className="label">קובץ עובדים (‎.xlsx)</label>
          <input id="file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required
            className="input file:me-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-bold file:text-slate-800" />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input type="checkbox" name="createUnits" className="size-5" />
          צור יחידות חסרות (יחידה שאינה קיימת תיווצר עם קוד אוטומטי)
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="preview" disabled={pending} className="btn-secondary">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileCheck2 className="size-4" aria-hidden />} בדיקת הקובץ
          </button>
          {state?.mode === "preview" && loadable > 0 && (
            <button type="submit" name="intent" value="commit" disabled={pending} className="btn-accent">
              <Upload className="size-4" aria-hidden /> טעינת {loadable} עובדים
            </button>
          )}
        </div>
        {state?.error && (
          <p role="alert" className="feedback-enter flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
          </p>
        )}
      </section>

      {plan && (
        <section className="card feedback-enter" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-bold">{state?.mode === "done" ? "הטעינה הושלמה" : "תוצאות הבדיקה – עדיין לא נשמר דבר"}</h2>
            {(["new", "update", "unchanged", "error"] as const).map((k) => (
              <span key={k} className={`badge ${STATUS[k].cls}`}>{STATUS[k].label}: {plan.counts[k]}</span>
            ))}
          </div>

          {state?.mode === "done" && (
            <div className="mb-4 space-y-2">
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
                <CheckCircle2 className="size-4" aria-hidden /> נוצרו {plan.counts.new} עובדים ועודכנו {plan.counts.update}
                {plan.newUnits.length > 0 && <> · נוצרו יחידות: {plan.newUnits.join(", ")}</>}
              </p>
              {state.credentialsFile && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="mb-2 flex items-center gap-2 font-bold"><KeyRound className="size-4" aria-hidden /> נוצרו {state.credentialsCount} סיסמאות זמניות</p>
                  <p className="mb-2">הקובץ זמין להורדה <b>עכשיו בלבד</b> – הסיסמאות לא נשמרות במערכת בטקסט גלוי. העבירו לעובדים בערוץ מאובטח ומחקו את הקובץ לאחר מכן.</p>
                  <a
                    className="btn-secondary"
                    download="סיסמאות-זמניות.xlsx"
                    href={`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${state.credentialsFile}`}
                  >
                    <Download className="size-4" aria-hidden /> הורדת קובץ הסיסמאות
                  </a>
                </div>
              )}
            </div>
          )}

          {plan.counts.error > 0 && state?.mode === "preview" && (
            <p className="mb-3 text-sm text-slate-700">שורות עם שגיאה לא ייטענו. ניתן לתקן בקובץ ולבדוק שוב, או לטעון רק את השורות התקינות.</p>
          )}
          {plan.newUnits.length > 0 && state?.mode === "preview" && (
            <p className="mb-3 text-sm text-slate-700">יחידות שייווצרו: <b>{plan.newUnits.join(", ")}</b></p>
          )}

          <div className="max-h-[28rem] overflow-auto">
            <table className="table-base min-w-[640px]">
              <thead className="sticky top-0 bg-white"><tr><th>שורה</th><th>מספר עובד</th><th>שם</th><th>יחידה</th><th>תפקיד</th><th>מצב</th><th>הערות</th></tr></thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr key={r.row} className={r.status === "error" ? "bg-red-50/50" : ""}>
                    <td className="text-slate-500">{r.row}</td>
                    <td className="ltr">{r.employeeNumber}</td>
                    <td>{r.fullName}</td>
                    <td>{r.unit}{r.newUnit && <span className="badge mr-1 bg-violet-100 text-violet-900">חדשה</span>}</td>
                    <td>{ROLE_HE[r.role] ?? r.role}</td>
                    <td><span className={`badge ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                    <td className="text-xs text-red-800">{r.messages.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </form>
  );
}
