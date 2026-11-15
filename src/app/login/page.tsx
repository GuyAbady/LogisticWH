import type { Metadata } from "next";
import { Warehouse } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "כניסה" };

const DEMO_USERS = [
  { role: 'מנהל מרלו"ג', email: "warehouse@demo.local" },
  { role: "מנהל יחידה", email: "it.manager@demo.local" },
  { role: "עובד", email: "avi@demo.local" },
];

export default function LoginPage() {
  const showDemo = process.env.NODE_ENV !== "production";
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-brand-600 p-3 text-white">
            <Warehouse className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">LogisticWH</h1>
          <p className="text-sm text-slate-600">ניהול מלאי, מצאי והחתמות ציוד</p>
        </div>
        <div className="card">
          <LoginForm />
        </div>
        {showDemo && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="mb-1 font-bold">משתמשי דוגמה (פיתוח בלבד) – סיסמה: <span className="ltr inline-block">Demo1234!</span></p>
            <ul className="space-y-0.5">
              {DEMO_USERS.map((u) => (
                <li key={u.email}>
                  {u.role}: <span className="ltr inline-block">{u.email}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
