"use client";

import { useActionState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { runSetup } from "@/app/actions/setup";

function Field(props: {
  name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; hint?: string; dir?: "ltr";
}) {
  return (
    <div>
      <label htmlFor={props.name} className="label">{props.label}</label>
      <input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue}
        required
        className={`input ${props.dir === "ltr" ? "ltr" : ""}`}
      />
      {props.hint && <p className="mt-1 text-xs text-slate-500">{props.hint}</p>}
    </div>
  );
}

export default function SetupForm() {
  const [state, action, pending] = useActionState(runSetup, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-2 font-bold">אימות</legend>
        <Field name="token" label="קוד הקמה" type="password" autoComplete="off" hint="הערך שהוגדר במשתנה SETUP_TOKEN ב-Vercel" />
      </fieldset>

      <fieldset className="space-y-3 border-t border-slate-200 pt-4">
        <legend className="mb-2 font-bold">יחידת המרלו&quot;ג</legend>
        <Field name="unitName" label="שם היחידה" defaultValue={v.unitName ?? 'מרלו"ג מרכזי'} />
        <Field name="unitCode" label="קוד יחידה" dir="ltr" defaultValue={v.unitCode ?? "WH"} hint="אותיות באנגלית / ספרות" />
      </fieldset>

      <fieldset className="space-y-3 border-t border-slate-200 pt-4">
        <legend className="mb-2 font-bold">מנהל המרלו&quot;ג הראשון</legend>
        <Field name="fullName" label="שם מלא" autoComplete="name" defaultValue={v.fullName} />
        <Field name="employeeNumber" label="מספר עובד" dir="ltr" defaultValue={v.employeeNumber} />
        <Field name="email" label='דוא"ל' type="email" autoComplete="email" defaultValue={v.email} />
        <Field name="phone" label="טלפון נייד" type="tel" autoComplete="tel" defaultValue={v.phone} />
        <Field name="password" label="סיסמה" type="password" autoComplete="new-password" hint="10 תווים לפחות, כולל אות וספרה" />
        <Field name="confirm" label="אימות סיסמה" type="password" autoComplete="new-password" />
      </fieldset>

      {state?.error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-base">
        <ShieldCheck className="size-5" />
        {pending ? "יוצר..." : "צור מנהל והיכנס"}
      </button>
    </form>
  );
}
