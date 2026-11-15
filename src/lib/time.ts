// המרות זמן לאזור Asia/Jerusalem. שרתי Vercel רצים ב-UTC, ולכן ערך datetime-local
// ("2026-11-20T10:00") חייב להתפרש כשעון ישראל ולא כ-UTC (הפרש של 2–3 שעות, תלוי שעון קיץ).
export const TZ = "Asia/Jerusalem";

function tzOffsetMinutes(at: Date, timeZone = TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "YYYY-MM-DDTHH:mm" בשעון ישראל → Date (UTC). מחזיר null לקלט לא תקין. */
export function israelLocalToUtc(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // שני סבבים – מטפל במעבר שעון קיץ/חורף
  let utc = guess - tzOffsetMinutes(new Date(guess)) * 60000;
  utc = guess - tzOffsetMinutes(new Date(utc)) * 60000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DDTHH:mm" בשעון ישראל (לערך ברירת מחדל ב-input) */
export function utcToIsraelLocal(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** ברירת מחדל למועד איסוף: מחר ב-09:00 שעון ישראל, בפורמט datetime-local */
export function defaultPickupLocal(now = new Date()) {
  return utcToIsraelLocal(new Date(now.getTime() + 24 * 3600 * 1000)).slice(0, 10) + "T09:00";
}
