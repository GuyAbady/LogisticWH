"use client";

import { useActionState } from "react";
import { LogIn, AlertCircle } from "lucide-react";
import { login } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">דוא&quot;ל</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" key={state?.email} defaultValue={state?.email} />
      </div>
      <div>
        <label htmlFor="password" className="label">סיסמה</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.error && (
        <p role="alert" className="feedback-enter flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-base">
        <LogIn className="size-5" />
        {pending ? "מתחבר..." : "כניסה"}
      </button>
    </form>
  );
}
