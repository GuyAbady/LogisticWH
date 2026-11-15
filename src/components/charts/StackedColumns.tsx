"use client";

import { useState } from "react";

/*
 * עמודות מוערמות לאורך זמן (dataviz):
 * - עובי עמודה ≤ 24px, קצה הנתונים מעוגל 4px והבסיס ישר; רווח 2px בצבע המשטח בין מקטעים.
 * - קווי רשת שערה (1px, רציף), צירים שקטים; ציר Y אחד בלבד.
 * - Tooltip לכל עמודה בריחוף ובפוקוס מקלדת: הערך מוביל, שם הסדרה משני, מפתח בקו קצר.
 * - כיוון הזמן בממשק RTL: מימין (ישן) לשמאל (חדש) – בכיוון הקריאה.
 * - כל ערך זמין גם בתצוגת הטבלה (ChartCard) – ה-tooltip משלים ואינו חוסם.
 */

type Datum = { key: string; label: string; full: string; values: number[] };
type Series = { name: string; color: string };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export default function StackedColumns({ data, series, height = 168 }: { data: Datum[]; series: Series[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => d.values.reduce((s, v) => s + v, 0));
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const labelEvery = Math.ceil(data.length / 5); // עד ~5 תוויות – גם במסך נייד צר

  return (
    <div className="relative pt-2" onPointerLeave={() => setActive(null)}>
      <div className="flex gap-2">
        {/* ציר Y – בצד ההתחלה (ימין ב-RTL) */}
        <div className="relative w-7 shrink-0 text-xs text-slate-500 tabular-nums" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute end-0 -translate-y-1/2 leading-none" style={{ bottom: `${(t / max) * 100}%` }}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className={`absolute inset-x-0 h-px ${t === 0 ? "bg-slate-300" : "bg-slate-100"}`}
              style={{ bottom: `${(t / max) * 100}%` }}
              aria-hidden
            />
          ))}
          <ol className="absolute inset-0 flex items-end justify-between gap-0.5" aria-label="עמודות לפי יום">
            {data.map((d, i) => {
              const total = totals[i];
              const parts = d.values.map((v, s) => ({ v, s })).filter((p) => p.v > 0);
              const readout = `${d.full}: ${series.map((s, k) => `${s.name} ${d.values[k]}`).join(", ")}`;
              return (
                <li key={d.key} className="flex h-full flex-1 justify-center">
                  <button
                    type="button"
                    className="group flex h-full w-full max-w-10 flex-col justify-end rounded-md outline-offset-1 focus-visible:bg-slate-50"
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    aria-label={readout}
                  >
                    <span
                      className={`mx-auto flex w-full max-w-6 flex-col-reverse gap-0.5 ${active !== null && active !== i ? "opacity-55" : ""}`}
                      style={{ height: `${(total / max) * 100}%` }}
                    >
                      {parts.map((p, k) => (
                        <span
                          key={p.s}
                          className={k === parts.length - 1 ? "rounded-t-[4px]" : ""}
                          style={{ flexGrow: p.v, flexBasis: 0, background: series[p.s].color, minHeight: 2 }}
                        />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
              // לצד העמודה, לכיוון מרכז הגרף – כדי לא להסתיר את העמודה המסומנת
              style={
                active < data.length / 2
                  ? { insetInlineStart: `calc(${((active + 0.5) / data.length) * 100}% + 1rem)` }
                  : { insetInlineEnd: `calc(${((data.length - active - 0.5) / data.length) * 100}% + 1rem)` }
              }
            >
              <p className="mb-1.5 font-bold text-slate-900">{data[active].full}</p>
              <ul className="space-y-1">
                {series.map((s, k) => (
                  <li key={s.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                      {s.name}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900">{data[active].values[k]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* תוויות ציר X – דלילות, לא תווית לכל עמודה */}
      <div className="ms-9 mt-1.5 flex justify-between text-xs text-slate-500" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center">
            {(data.length - 1 - i) % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
