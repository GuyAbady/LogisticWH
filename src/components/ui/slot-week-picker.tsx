"use client";

/*
 * בוחר משבצות שבועי – מבוסס על הרכיב SlotWeekPicker (21st.dev), מותאם ל-LogisticWH:
 * עברית ו-RTL, שעון ישראל, פלטת slate/ירוק מלאי, Arial.
 * שינויים מכוונים מול המקור (סקילים emil-design-eng / animation-performance / CLAUDE.md):
 *  - הוסרו: גרדיאנט סגול, הטיית תלת-ממד, הילה עוקבת, אפקט "נוזל" (פילטר blur מונפש – יקר לצביעה),
 *    פיצוץ חלקיקים והבהוב מתמשך בכפתור. כלי עבודה תכוף – תנועה חוזרת מעייפת ולא מוסיפה מידע.
 *  - נשמרו: רצועת ימים עם גרירה בין שבועות, סמן בחירה שגולש (layoutId – transform בלבד),
 *    ניווט מקלדת ברשת, הסבר למשבצת חסומה בריחוף/פוקוס, ספירה לאחור עד המועד.
 *  - נוסף: `name` – שדה מוסתר בפורמט datetime-local ("YYYY-MM-DDTHH:mm" באזור הזמן) לשימוש בטופס Server Action.
 *  - prefers-reduced-motion: MotionConfig reducedMotion="user" מבטל תנועת transform.
 */

import * as React from "react";
import { MotionConfig, animate, motion, useMotionValue } from "framer-motion";
import { Ban, CalendarCheck, ChevronLeft, ChevronRight, Clock, Hourglass, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Slot {
  /** ISO timestamp, any offset. */
  start: string;
  /** Set this and the slot is shown as taken, with the reason on hover and focus. */
  unavailableReason?: string;
}

export interface SlotWeekPickerProps {
  slots: Slot[];
  /** IANA zone used to display everything. Default: Asia/Jerusalem. */
  timeZone?: string;
  /** Length of one slot in minutes. Default 30. */
  slotMinutes?: number;
  /** Slots that begin sooner than this are blocked with a reason. Default 2. */
  minNoticeHours?: number;
  /** Override "now" (pass from the server to keep SSR and hydration identical). */
  now?: Date | string;
  /** How many weeks ahead can be browsed (including the current one). Default 4. */
  maxWeeks?: number;
  /** Weekdays shown in the strip (0 = Sunday). Default: all seven. Fewer days = larger tap targets on narrow phones. */
  weekDays?: number[];
  title?: string;
  /** Hidden form field name; value is local "YYYY-MM-DDTHH:mm" in `timeZone`. */
  name?: string;
  /** Initially selected slot (ISO). Default: the first free slot. */
  defaultValue?: string;
  onChange?: (slot: Slot | null) => void;
  /** If given, a confirm button is shown. */
  onConfirm?: (slot: Slot) => Promise<void> | void;
  className?: string;
}

const DAY = 86_400_000;
const keyOf = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (key: string, n: number) => new Date(new Date(key + "T12:00:00Z").getTime() + n * DAY).toISOString().slice(0, 10);
const noon = (key: string) => new Date(key + "T12:00:00Z");
const fmt = (d: Date, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("he-IL", { timeZone: tz, ...o }).format(d);
const timeLabel = (d: Date, tz: string) => fmt(d, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function localValue(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function until(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const hrs = (n: number) => (n === 1 ? "שעה" : n === 2 ? "שעתיים" : `${n} שעות`);
  if (h < 24) return m % 60 ? `${hrs(h)} ו-${m % 60} דק׳` : hrs(h);
  const d = Math.floor(h / 24);
  const days = d === 1 ? "יום אחד" : d === 2 ? "יומיים" : `${d} ימים`;
  return h % 24 ? `${days} ו${hrs(h % 24)}` : days;
}

/** תנועה: קפיצית אבל בלי "קפיצה" מעבר ליעד (Emil: ease-out, ~200ms) */
const SLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 } as const;

export function SlotWeekPicker({
  slots, timeZone = "Asia/Jerusalem", slotMinutes = 30, minNoticeHours = 2, now, maxWeeks = 4, weekDays,
  title = "בחירת מועד", name, defaultValue, onChange, onConfirm, className,
}: SlotWeekPickerProps) {
  const tz = timeZone;
  const gid = React.useId();
  // "עכשיו" קבוע מהשרת בזמן הרינדור (SSR והידרציה זהים), ומתקדם כל 30 שניות בדפדפן
  const [base] = React.useState(() => (now ? new Date(now).getTime() : Date.now()));
  const [clock, setClock] = React.useState(base);
  React.useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setClock(base + (Date.now() - t0)), 30_000);
    return () => clearInterval(id);
  }, [base]);

  const all = React.useMemo(
    () => slots.map((s) => {
      const date = new Date(s.start), ms = date.getTime();
      const reason = ms <= clock ? "המועד כבר עבר"
        : s.unavailableReason ?? (ms - clock < minNoticeHours * 3_600_000 ? `נדרשת התראה של ${minNoticeHours} שעות לפחות` : undefined);
      return { ...s, date, key: keyOf(date, tz), reason };
    }).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [slots, tz, clock, minNoticeHours],
  );

  const todayKey = keyOf(new Date(clock), tz);
  const week0 = addDays(todayKey, -noon(todayKey).getUTCDay()); // השבוע מתחיל ביום א'

  // בחירה ראשונית: הערך שהועבר, אחרת המשבצת הפנויה הראשונה (כמו ברירת המחדל "מחר 09:00" שהייתה)
  const [picked, setPicked] = React.useState<string | null>(() => {
    if (defaultValue) return defaultValue;
    return all.find((s) => !s.reason)?.start ?? null;
  });
  const initialKey = picked ? keyOf(new Date(picked), tz) : todayKey;
  const [dayKey, setDayKey] = React.useState(initialKey);
  const [week, setWeek] = React.useState(() => Math.max(0, Math.floor((noon(initialKey).getTime() - noon(week0).getTime()) / (7 * DAY))));
  const [dir, setDir] = React.useState(0);
  const [focusIdx, setFocusIdx] = React.useState(0);
  const [peek, setPeek] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
  const cells = React.useRef<(HTMLButtonElement | null)[]>([]);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const stripX = useMotionValue(0);

  const start = addDays(week0, week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((k) => !weekDays || weekDays.includes(noon(k).getUTCDay()));
  const daySlots = all.filter((s) => s.key === dayKey);
  const sel = all.find((s) => s.start === picked && !s.reason);

  const goWeek = (n: number) => {
    const w = Math.min(maxWeeks - 1, Math.max(0, week + n));
    if (w === week) { animate(stripX, 0, SLIDE); return; }
    setDir(n); setWeek(w); setFocusIdx(0); setPeek(null);
    const ws = addDays(week0, w * 7);
    // ביום הראשון בשבוע החדש שיש בו משבצת פנויה, אחרת היום הראשון
    const firstFree = all.find((s) => !s.reason && s.key >= ws && s.key < addDays(ws, 7));
    setDayKey(firstFree?.key ?? (w === 0 && days.includes(todayKey) ? todayKey : addDays(ws, weekDays ? Math.min(...weekDays) : 0)));
  };
  const choose = (i: number) => {
    const s = daySlots[i];
    if (!s || s.reason) return;
    setPicked(s.start); setStatus("idle");
    onChange?.({ start: s.start, unavailableReason: s.unavailableReason });
  };
  const cols = () => (gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns.split(" ").length : 3);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = daySlots.length, c = cols();
    // RTL: חץ שמאלה = המשבצת הבאה בסדר הקריאה
    const move: Record<string, number> = { ArrowLeft: i + 1, ArrowRight: i - 1, ArrowDown: i + c, ArrowUp: i - c, Home: 0, End: n - 1 };
    if (e.key in move) {
      e.preventDefault();
      const next = Math.min(n - 1, Math.max(0, move[e.key]));
      setFocusIdx(next); setPeek(next); cells.current[next]?.focus();
    } else if (e.key === " " || e.key === "Enter") { e.preventDefault(); choose(i); }
  };
  const confirm = async () => {
    if (!sel || status === "busy") return;
    setStatus("busy");
    try { await onConfirm?.({ start: sel.start, unavailableReason: sel.unavailableReason }); setStatus("done"); } catch { setStatus("idle"); }
  };

  const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).format(new Date(clock)).split(" ").pop()?.replace("GMT", "UTC");
  const tzName = tz === "Asia/Jerusalem" ? "שעון ישראל" : tz.replace(/_/g, " ");
  const range = `${fmt(noon(days[0]), "UTC", { day: "numeric", month: "short" })} – ${fmt(noon(days[days.length - 1]), "UTC", { day: "numeric", month: "short" })}`;
  const peeked = peek !== null ? daySlots[peek] : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label={title} className={cn("w-full rounded-xl border border-slate-200 bg-white px-1.5 py-3 sm:p-4", className)}>
        {name && <input type="hidden" name={name} value={sel ? localValue(sel.date, tz) : ""} />}

        <header className="mb-3 flex items-center justify-between gap-3 px-1.5 sm:px-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p aria-live="polite" className="text-xs text-slate-600">{week === 0 ? "השבוע · " : ""}{range}</p>
          </div>
          <div className="flex gap-1.5">
            {/* RTL: "הקודם" מימין עם חץ ימינה, "הבא" משמאל עם חץ שמאלה */}
            <button type="button" onClick={() => goWeek(-1)} disabled={week === 0} aria-label="השבוע הקודם"
              className="btn-secondary size-11 min-h-11 p-0"><ChevronRight className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => goWeek(1)} disabled={week >= maxWeeks - 1} aria-label="השבוע הבא"
              className="btn-secondary size-11 min-h-11 p-0"><ChevronLeft className="size-4" aria-hidden /></button>
          </div>
        </header>

        {/* רצועת ימים: גרירה ימינה = השבוע הבא (ציר הזמן ב-RTL זורם מימין לשמאל) */}
        <div className="overflow-hidden">
          <motion.div
            key={week}
            role="tablist"
            aria-label="ימים"
            className="grid touch-pan-y gap-0 sm:gap-1"
            style={{ x: stripX, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            initial={dir ? { opacity: 0, x: dir > 0 ? -24 : 24 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25}
            onDragEnd={(_, i) => {
              const d = i.offset.x + i.velocity.x * 0.2;
              if (d > 60) goWeek(1); else if (d < -60) goWeek(-1); else animate(stripX, 0, SLIDE);
            }}
          >
            {days.map((k) => {
              const free = all.filter((s) => s.key === k && !s.reason).length;
              const on = k === dayKey;
              const d = noon(k);
              return (
                <button key={k} type="button" role="tab" aria-selected={on}
                  onClick={() => { setDayKey(k); setFocusIdx(0); setPeek(null); }}
                  aria-label={`${fmt(d, "UTC", { weekday: "long", day: "numeric", month: "long" })}, ${free ? `${free} מועדים פנויים` : "אין מועדים פנויים"}`}
                  className="relative flex h-16 min-w-0 flex-col items-center justify-center rounded-lg text-xs">
                  {on && <motion.span layoutId={`${gid}-day`} aria-hidden className="absolute inset-0 rounded-lg bg-brand-600" transition={SLIDE} />}
                  <span className={cn("relative", on ? "text-white/85" : "text-slate-600")}>{fmt(d, "UTC", { weekday: "short" })}</span>
                  <span className={cn("relative text-base font-bold tabular", on ? "text-white" : free ? "text-slate-900" : "text-slate-400")}>{fmt(d, "UTC", { day: "numeric" })}</span>
                  <span aria-hidden className="relative mt-0.5 flex h-1.5 gap-0.5">
                    {Array.from({ length: Math.min(free, 4) }).map((_, i) => <span key={i} className={cn("size-1 rounded-full", on ? "bg-white/80" : "bg-accent-600")} />)}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </div>

        {/* משבצות היום הנבחר – מתחלפות מיד (פעולה תכופה, ללא אנימציה) */}
        <div className="mt-3 min-h-[7.5rem] px-1.5 sm:px-0">
          {daySlots.length === 0 ? (
            <p className="grid h-28 place-items-center rounded-lg bg-slate-50 text-sm text-slate-600">אין מועדי איסוף ביום זה</p>
          ) : (
            <div ref={gridRef} role="radiogroup" aria-label={`מועדים ב${fmt(noon(dayKey), "UTC", { weekday: "long", day: "numeric", month: "long" })}`}
              className="grid grid-cols-3 gap-2 sm:grid-cols-4" onMouseLeave={() => setPeek(null)}>
              {daySlots.map((s, i) => {
                const on = s.start === sel?.start;
                return (
                  <button key={s.start} ref={(el) => { cells.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-disabled={!!s.reason || undefined}
                    tabIndex={i === Math.min(focusIdx, daySlots.length - 1) ? 0 : -1}
                    onClick={() => choose(i)} onKeyDown={(e) => onKey(e, i)}
                    onFocus={() => { setFocusIdx(i); setPeek(i); }} onMouseEnter={() => setPeek(i)} onBlur={() => setPeek(null)}
                    className={cn(
                      "relative flex min-h-11 items-center justify-center gap-1 rounded-lg border text-sm font-bold tabular transition-[transform,border-color] duration-150 ease-[var(--ease-out)] active:scale-[0.97]",
                      s.reason ? "cursor-not-allowed border-dashed border-slate-300 text-slate-500 line-through decoration-slate-400 active:scale-100"
                        : on ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-900 hover:border-accent-600",
                    )}>
                    {on && <motion.span layoutId={`${gid}-slot`} aria-hidden className="absolute inset-0 rounded-[7px] bg-accent-600" transition={SLIDE} />}
                    {s.reason && <Ban className="size-3 shrink-0" aria-hidden />}
                    <span className="relative">{timeLabel(s.date, tz)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p aria-live="polite" className="mt-2 min-h-5 px-1.5 text-xs text-slate-600 sm:px-0">
          {peeked?.reason && (
            <span className="inline-flex items-center gap-1.5"><Ban className="size-3.5" aria-hidden /> {timeLabel(peeked.date, tz)} – לא זמין: {peeked.reason}</span>
          )}
        </p>

        <footer className="mx-1.5 mt-2 border-t border-slate-100 pt-3 sm:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-sm" aria-live="polite">
              {sel ? (
                <>
                  <p className="font-bold text-slate-900">
                    {fmt(sel.date, tz, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
                    <span className="ltr inline-block tabular">{timeLabel(sel.date, tz)}–{timeLabel(new Date(sel.date.getTime() + slotMinutes * 60000), tz)}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600"><Hourglass className="size-3" aria-hidden /> בעוד {until(sel.date.getTime() - clock)}</p>
                </>
              ) : (
                <p className="text-slate-600">לא נבחר מועד</p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="size-3" aria-hidden /> {tzName} <span className="ltr inline-block">({offset})</span></p>
            </div>
            {onConfirm && (
              <button type="button" onClick={confirm} disabled={!sel || status === "busy"} className="btn-accent shrink-0">
                {status === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" aria-hidden />}
                {status === "done" ? "המועד נשמר" : "אישור מועד"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </MotionConfig>
  );
}

export default SlotWeekPicker;
