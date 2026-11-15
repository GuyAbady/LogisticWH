"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** ניקוי השדות לאחר הצלחה */
  resetOnSuccess?: boolean;
  /** בקשת אישור לפני שליחה (פעולות בלתי הפיכות) */
  confirmText?: string;
  className?: string;
  buttonClassName?: string;
};

export default function ActionForm({
  action, children, submitLabel, pendingLabel = "שומר...", resetOnSuccess, confirmText, className, buttonClassName,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className ?? "space-y-3"}
      onSubmit={(e) => {
        // React 19 מאפס את כל שדות הטופס אחרי כל שליחה דרך action – גם כשהשרת מחזיר שגיאת אימות,
        // והמשתמש מאבד את מה שהקליד. שליחה ידנית בתוך startTransition עוקפת את האיפוס האוטומטי;
        // הניקוי נעשה רק לאחר הצלחה (resetOnSuccess). ללא JavaScript – הטופס נשלח כרגיל דרך action.
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="feedback-enter flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="feedback-enter flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.ok}
        </p>
      )}
      <button type="submit" disabled={pending} aria-busy={pending} className={buttonClassName ?? "btn-primary"}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
