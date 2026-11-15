import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";

/*
 * רכיבי תצוגה גרפית – לפי מתודת ה-dataviz:
 * - פלטה קטגורית: 3 החריצים הראשונים של פלטת הייחוס (כחול/כתום/טורקיז), עברו את המאמת
 *   על משטח לבן (CVD ΔE 9.2, ראייה רגילה 27.6). לטורקיז ניגודיות 2.82:1 → מקרא + טבלה + tooltip.
 * - טקסט לעולם אינו בצבע הסדרה; זהות = סימון צבעוני לצד הטקסט.
 * - סטטוס (טוב/אזהרה/קריטי) תמיד עם אייקון + תווית, לא בצבע בלבד.
 */

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
export const STATUS = { good: "#0ca30c", warning: "#fab219", critical: "#d03b3b" } as const;

const INK_MUTED = "#64748b";

/** מקרא – ריבועים לפסים/שטחים; תמיד מוצג לשתי סדרות ומעלה */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="מקרא">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * פס מפולח דק (8px) – חלוקה של שלם לחלקים בתוך שורת טבלה/רשימה.
 * ללא טקסט על הפס (הספרות לצידו); רווח 2px בין חלקים; קצוות מעוגלים; חלק באפס לא מצויר.
 */
export function ThinSegmentedBar({ parts, label }: { parts: { value: number; color: string; name: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const visible = parts.filter((p) => p.value > 0);
  const text = `${label}: ${parts.map((p) => `${p.name} ${p.value}`).join(", ")}`;
  return (
    <div role="img" aria-label={text} title={text} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
      {total > 0 &&
        visible.map((p) => (
          <span key={p.name} className="h-full first:rounded-s-full last:rounded-e-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
    </div>
  );
}

type MeterRow = { id: string; name: string; href?: string; value: number; max: number; icon?: React.ReactNode };

function severity(ratio: number) {
  if (ratio < 0.15) return { color: STATUS.critical, track: "#f7d8d8", label: "קריטי", Icon: OctagonAlert, ink: "text-red-800" };
  if (ratio < 0.3) return { color: STATUS.warning, track: "#fdeec9", label: "נמוך", Icon: AlertTriangle, ink: "text-amber-900" };
  return { color: STATUS.good, track: "#d3efd3", label: "תקין", Icon: CheckCircle2, ink: "text-emerald-800" };
}

/**
 * רשימת מדים (Meter list) – זמינות מלאי מול הסה"כ לכל פריט.
 * המילוי נושא חומרה; המסלול הוא גוון בהיר מאותה משפחה; סטטוס עם אייקון + תווית.
 */
export function MeterList({ rows }: { rows: MeterRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const ratio = r.max > 0 ? r.value / r.max : 0;
        const s = severity(ratio);
        return (
          <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              {r.icon}
              {r.href ? <a href={r.href} className="link truncate">{r.name}</a> : <span className="truncate font-bold">{r.name}</span>}
            </span>
            <span className={`flex items-center gap-1 text-xs font-bold ${s.ink}`}>
              <s.Icon className="size-3.5" aria-hidden /> {s.label}
            </span>
            <span
              role="meter"
              aria-valuemin={0}
              aria-valuemax={r.max}
              aria-valuenow={r.value}
              aria-label={`${r.name}: ${r.value} זמינים מתוך ${r.max}`}
              className="h-2 overflow-hidden rounded-full"
              style={{ background: s.track }}
            >
              <span className="block h-full rounded-full" style={{ width: `${Math.max(ratio * 100, r.value > 0 ? 2 : 0)}%`, background: s.color }} />
            </span>
            <span className="tabular text-xs whitespace-nowrap text-slate-600">
              {r.value} מתוך {r.max}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * עמודות מדורגות אופקיות – השוואת גדלים, גוון אחד (סדרה אחת → ללא מקרא, הכותרת מתארת).
 * עובי ≤ 24px, קצה מעוגל 4px והבסיס ישר; ערך בקצה העמודה.
 */
export function RankedBars({ rows, color = SERIES[0], unit }: { rows: { id: string; label: string; value: number; href?: string }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3 text-sm">
          <span className="truncate text-slate-700">{r.href ? <a className="link" href={r.href}>{r.label}</a> : r.label}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-4 rounded-e-[4px]"
              style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0)}%`, background: color, maxWidth: "calc(100% - 3rem)" }}
              aria-hidden
            />
            <span className="tabular shrink-0 text-xs font-bold text-slate-900">
              {r.value}
              {unit && <span className="font-normal text-slate-500"> {unit}</span>}
            </span>
          </span>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm" style={{ color: INK_MUTED }}>אין נתונים</li>}
    </ul>
  );
}

/** עטיפת כרטיס גרף: כותרת, תת-כותרת, תוכן ותצוגת טבלה נגישה */
export function ChartCard({
  title, subtitle, icon, children, table, className,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; table?: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      <header className="mb-4 flex items-start gap-3">
        {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
      </header>
      {children}
      {table && (
        <details className="mt-4 border-t border-slate-100 pt-3 text-sm">
          <summary className="cursor-pointer text-xs font-bold text-slate-600">הצג כטבלה</summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      )}
    </section>
  );
}
