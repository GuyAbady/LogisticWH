"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays } from "lucide-react";
import { SlotWeekPicker } from "@/components/ui/slot-week-picker";
import { buildPickupSlots, PICKUP_SCHEDULE } from "@/lib/pickup-slots";

/** ימי הפעילות בלבד (א'–ה') – פחות עמודות = יעדי מגע רחבים יותר בטלפון צר */
const WEEK_DAYS = Object.keys(PICKUP_SCHEDULE.days).map(Number);

/**
 * בחירת מועד איסוף בהקצאה. המשבצות נבנות בדפדפן מתוך PICKUP_SCHEDULE,
 * כך שהשרת מעביר רק את המועדים התפוסים (מטען קטן גם כשיש הרבה דרישות בתור).
 * "מועד אחר" – שדה תאריך-שעה חופשי, לחריגים מחוץ לשעות הפעילות.
 * שני המצבים שולחים `pickupDate` בפורמט datetime-local בשעון ישראל (israelLocalToUtc בשרת).
 */
export default function PickupSlotPicker({ taken, now, fallbackLocal, id }: { taken: string[]; now: string; fallbackLocal: string; id: string }) {
  const [manual, setManual] = useState(false);
  const slots = useMemo(() => buildPickupSlots(new Date(now), taken), [now, taken]);

  return (
    <fieldset>
      <legend className="label">מועד איסוף</legend>
      {manual ? (
        <input id={id} name="pickupDate" type="datetime-local" required defaultValue={fallbackLocal} className="input" aria-label="מועד איסוף" />
      ) : (
        <SlotWeekPicker
          slots={slots}
          now={now}
          name="pickupDate"
          title="משבצות פנויות במרלו״ג"
          slotMinutes={PICKUP_SCHEDULE.slotMinutes}
          minNoticeHours={PICKUP_SCHEDULE.minNoticeHours}
          maxWeeks={PICKUP_SCHEDULE.weeks}
          weekDays={WEEK_DAYS}
        />
      )}
      <button type="button" onClick={() => setManual((m) => !m)} className="link mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm">
        {manual ? <CalendarDays className="size-4" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
        {manual ? "חזרה לבחירה מהמשבצות" : "מועד אחר (מחוץ למשבצות)"}
      </button>
    </fieldset>
  );
}
