import { Check } from "lucide-react";
import type { RequestStatus } from "@/generated/prisma/enums";
import { REQUEST_STATUS, REQUEST_STEPS, requestStepIndex } from "@/lib/request-labels";
import { fmtDateTime } from "./ui";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = REQUEST_STATUS[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

/** ציר התקדמות: הוגשה → אישור מנהל → הקצאה → חתימה */
export function RequestSteps({ status }: { status: RequestStatus }) {
  const idx = requestStepIndex(status);
  if (idx < 0) return null;
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="שלבי הבקשה">
      {REQUEST_STEPS.map((label, i) => {
        const done = i < idx || status === "FULFILLED";
        const current = i === idx && status !== "FULFILLED";
        return (
          <li key={label} className="flex flex-col gap-1">
            <span className={`h-1 rounded-full ${done ? "bg-accent-600" : current ? "bg-slate-400" : "bg-slate-200"}`} />
            <span className={`flex items-center gap-0.5 text-xs leading-tight ${done ? "text-slate-900" : current ? "font-bold text-slate-900" : "text-slate-500"}`}>
              {done && <Check className="size-3 shrink-0 text-accent-600" aria-hidden />}
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Req = {
  id: string;
  status: RequestStatus;
  quantity: number;
  createdAt: Date;
  pickupDate: Date | null;
  justification: string | null;
  managerNote: string | null;
  warehouseNote: string | null;
  catalogItem: { name: string; sku: string; requiresSerial: boolean };
  requester?: { fullName: string; employeeNumber: string; unit?: { name: string } };
};

export function RequestCard({ r, children, showRequester }: { r: Req; children?: React.ReactNode; showRequester?: boolean }) {
  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">
            {r.catalogItem.name} <span className="font-normal text-slate-600">× {r.quantity}</span>
          </h3>
          <p className="text-xs text-slate-600">
            <span className="ltr inline-block font-mono">{r.catalogItem.sku}</span> · הוגשה {fmtDateTime(r.createdAt)}
          </p>
          {showRequester && r.requester && (
            <p className="mt-1 text-sm text-slate-700">
              {r.requester.fullName} <span className="text-xs text-slate-500">({r.requester.employeeNumber})</span>
              {r.requester.unit && <> · {r.requester.unit.name}</>}
            </p>
          )}
        </div>
        <RequestStatusBadge status={r.status} />
      </div>

      {(r.justification || r.managerNote || r.warehouseNote || r.pickupDate) && (
        <dl className="mt-3 grid gap-1 text-sm">
          {r.justification && <div><dt className="inline text-slate-500">נימוק: </dt><dd className="inline">{r.justification}</dd></div>}
          {r.managerNote && <div><dt className="inline text-slate-500">מנהל היחידה: </dt><dd className="inline">{r.managerNote}</dd></div>}
          {r.warehouseNote && <div><dt className="inline text-slate-500">מרלו&quot;ג: </dt><dd className="inline">{r.warehouseNote}</dd></div>}
          {r.pickupDate && r.status === "ALLOCATED" && (
            <div><dt className="inline text-slate-500">מועד איסוף: </dt><dd className="inline font-bold">{fmtDateTime(r.pickupDate)}</dd></div>
          )}
        </dl>
      )}
      <RequestSteps status={r.status} />
      {children && <div className="mt-4 border-t border-slate-100 pt-3">{children}</div>}
    </article>
  );
}
