import type { Metadata } from "next";
import { FileSpreadsheet, PenLine, ScanLine, ShieldCheck, Warehouse } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "כניסה" };

const DEMO_USERS = [
  { role: 'מנהל מרלו"ג', email: "warehouse@demo.local" },
  { role: "מנהל יחידה", email: "it.manager@demo.local" },
  { role: "עובד", email: "avi@demo.local" },
];

const FEATURES = [
  { icon: ScanLine, title: "איתור וסריקה", text: "מיקום כל פריט ומספר סידורי בשניות, כולל סריקת ברקוד מהנייד" },
  { icon: PenLine, title: "חתימה דיגיטלית", text: "החתמה וזיכוי בנייד, עם קבלה מאומתת לכל פעולה" },
  { icon: FileSpreadsheet, title: "דוחות Excel", text: "מלאי, שיוכים ויומן תנועות בלחיצה" },
];

export default function LoginPage() {
  const showDemo = process.env.NODE_ENV !== "production";
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/* פאנל מותג – מחשב בלבד */}
      <section
        className="relative hidden overflow-hidden bg-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Warehouse className="size-6" aria-hidden /></span>
          <span className="text-xl font-bold tracking-tight">LogisticWH</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-balance">כל הציוד של הארגון. במקום אחד, בכל רגע.</h2>
          <p className="mt-3 text-base text-slate-300">ניהול מלאי, מצאי והחתמות ציוד דיגיטליות במרלו&quot;ג – מהמחסן ועד הנייד של העובד.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-600 text-white"><f.icon className="size-5" aria-hidden /></span>
                <span>
                  <span className="block font-bold">{f.title}</span>
                  <span className="text-sm text-slate-300">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="size-4" aria-hidden /> חיבור מוצפן · הרשאות לפי תפקיד · יומן פעולות מלא</p>
      </section>

      {/* טופס כניסה */}
      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="feedback-enter w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:items-start lg:text-start">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm lg:hidden"><Warehouse className="size-6" aria-hidden /></span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">כניסה למערכת</h1>
              <p className="mt-1 text-sm text-slate-600">הזינו את פרטי המשתמש שקיבלתם מהמרלו&quot;ג</p>
            </div>
          </div>
          <div className="card p-5 md:p-6">
            <LoginForm />
          </div>
          {showDemo && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="mb-1 font-bold">משתמשי דוגמה (פיתוח בלבד) – סיסמה: <span className="ltr inline-block">Demo1234!</span></p>
              <ul className="space-y-0.5">
                {DEMO_USERS.map((u) => (
                  <li key={u.email}>{u.role}: <span className="ltr inline-block">{u.email}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
