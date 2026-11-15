import "server-only";
import { db } from "./db";
import { TZ } from "./time";

/** פעילות יומית ב-N הימים האחרונים (שעון ישראל): קליטות / מסירות / החזרות – מספר פעולות */
export async function dailyActivity(days = 14) {
  const rows = await db.$queryRaw<{ d: string; type: string; n: number }[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS d,
           type::text AS type, count(*)::int AS n
    FROM "Transaction"
    WHERE "createdAt" >= now() - (${days}::int * interval '1 day')
      AND type IN ('STOCK_IN', 'ISSUE', 'RETURN')
    GROUP BY 1, 2`;
  const fmtKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
  const fmtShort = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "numeric" });
  const fmtFull = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const key = fmtKey.format(date);
    const get = (t: string) => rows.find((r) => r.d === key && r.type === t)?.n ?? 0;
    out.push({ key, label: fmtShort.format(date), full: fmtFull.format(date), values: [get("STOCK_IN"), get("ISSUE"), get("RETURN")] });
  }
  return out;
}
