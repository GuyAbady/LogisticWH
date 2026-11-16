import { israelLocalToUtc, TZ } from "./time";

/*
 * משבצות לאיסוף ציוד מהמרלו"ג (משותף לשרת ולדפדפן – ללא גישה ל-DB).
 * שעות הפעילות הן הנחת עבודה: א'–ה' 08:00–16:00 (המשבצת האחרונה מתחילה ב-15:30).
 * לשינוי – לעדכן כאן בלבד; הבדיקה בשרת (allocateRequest) משתמשת באותה קיבולת.
 */
export const PICKUP_SCHEDULE = {
  slotMinutes: 30,
  weeks: 4,
  minNoticeHours: 2,
  /** כמה איסופים מותרים באותה משבצת */
  capacity: 1,
  /** יום בשבוע (0 = ראשון) → [שעת התחלה ראשונה, שעת התחלה אחרונה] */
  days: { 0: ["08:00", "15:30"], 1: ["08:00", "15:30"], 2: ["08:00", "15:30"], 3: ["08:00", "15:30"], 4: ["08:00", "15:30"] } as Record<number, [string, string]>,
};

export type PickupSlot = { start: string; unavailableReason?: string };

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const addDays = (key: string, n: number) => new Date(new Date(key + "T12:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** משבצות מתחילת השבוע הנוכחי (יום א') ל-`weeks` שבועות; משבצת שהתמלאה מסומנת כתפוסה */
export function buildPickupSlots(now: Date, takenIso: string[], schedule = PICKUP_SCHEDULE): PickupSlot[] {
  const taken = new Map<number, number>();
  for (const t of takenIso) {
    const ms = new Date(t).getTime();
    taken.set(ms, (taken.get(ms) ?? 0) + 1);
  }
  const today = dayKey(now);
  const weekStart = addDays(today, -new Date(today + "T12:00:00Z").getUTCDay());
  const out: PickupSlot[] = [];
  for (let i = 0; i < schedule.weeks * 7; i++) {
    const key = addDays(weekStart, i);
    const hours = schedule.days[new Date(key + "T12:00:00Z").getUTCDay()];
    if (!hours) continue;
    for (let m = toMin(hours[0]); m <= toMin(hours[1]); m += schedule.slotMinutes) {
      const at = israelLocalToUtc(`${key}T${toHHMM(m)}`);
      if (!at) continue;
      const count = taken.get(at.getTime()) ?? 0;
      out.push({ start: at.toISOString(), unavailableReason: count >= schedule.capacity ? "המועד שמור לאיסוף אחר" : undefined });
    }
  }
  return out;
}
