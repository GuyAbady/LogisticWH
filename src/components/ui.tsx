import { Construction, Inbox } from "lucide-react";
import type { SerialStatus } from "@/generated/prisma/enums";

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-slate-200 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm" aria-hidden>
            {icon}
          </span>
        )}
        <div className="min-w-0">
        <h1 className="text-xl font-bold text-balance text-slate-900 md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

// גווני שבב לאייקון – רקע בהיר + אייקון בגוון כהה (ניגודיות ≥ 4.5:1 לאייקון)
const TONES = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-sky-50 text-sky-800",
  green: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-800",
  violet: "bg-violet-50 text-violet-800",
  red: "bg-red-50 text-red-800",
} as const;
export type Tone = keyof typeof TONES;

/** אריח נתון (Stat tile): תווית · ערך · רמז; ערך בספרות פרופורציונליות (dataviz) */
export function StatCard({ label, value, hint, icon, tone = "slate", href }: {
  label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: Tone; href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-slate-600">{label}</p>
        {icon && <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${TONES[tone]}`} aria-hidden>{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </>
  );
  return href ? <a href={href} className="card block hover:border-slate-300">{inner}</a> : <div className="card">{inner}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-600">
      <Inbox className="size-6 text-slate-400" aria-hidden />
      {text}
    </div>
  );
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
