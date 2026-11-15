import { Construction } from "lucide-react";
import type { SerialStatus } from "@/generated/prisma/enums";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{text}</p>;
}

export function ComingSoon({ stage, title, bullets }: { stage: number; title: string; bullets: string[] }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="card flex gap-4">
        <Construction className="size-8 shrink-0 text-amber-500" />
        <div>
          <p className="font-bold">מסך זה ייבנה בשלב {stage} של התוכנית.</p>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-slate-700">
            {bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const SERIAL_STATUS: Record<SerialStatus, { label: string; cls: string }> = {
  IN_STOCK: { label: "במחסן", cls: "bg-slate-100 text-slate-700" },
  ALLOCATED: { label: "הוקצה – ממתין לאיסוף", cls: "bg-amber-100 text-amber-800" },
  PENDING_ACK: { label: "ממתין לאישור עובד", cls: "bg-orange-100 text-orange-800" },
  SIGNED: { label: "חתום", cls: "bg-emerald-100 text-emerald-800" },
  PENDING_RETURN: { label: "זומן להחזרה", cls: "bg-red-100 text-red-800" },
  IN_REPAIR: { label: "בתיקון", cls: "bg-purple-100 text-purple-800" },
  WRITTEN_OFF: { label: "נגרע", cls: "bg-slate-200 text-slate-500" },
};

export function SerialBadge({ status }: { status: SerialStatus }) {
  const s = SERIAL_STATUS[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeZone: "Asia/Jerusalem" }).format(d);

export const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(d);
