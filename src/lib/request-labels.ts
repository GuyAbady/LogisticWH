import type { RequestStatus } from "@/generated/prisma/enums";

// תוויות וצבעים לסטטוס בקשה – ללא תלות בשרת (משמש גם ברכיבי לקוח)
export const REQUEST_STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  PENDING_MANAGER: { label: "ממתין למנהל יחידה", cls: "bg-amber-100 text-amber-900" },
  REJECTED_MANAGER: { label: "נדחה ע\"י מנהל היחידה", cls: "bg-red-100 text-red-800" },
  PENDING_WAREHOUSE: { label: 'ממתין למרלו"ג', cls: "bg-sky-100 text-sky-900" },
  REJECTED_WAREHOUSE: { label: 'נדחה ע"י המרלו"ג', cls: "bg-red-100 text-red-800" },
  ALLOCATED: { label: "מוכן לאיסוף וחתימה", cls: "bg-violet-100 text-violet-900" },
  FULFILLED: { label: "נמסר ונחתם", cls: "bg-emerald-100 text-emerald-900" },
  CANCELLED: { label: "בוטל", cls: "bg-slate-200 text-slate-700" },
};

// שלבי הזרימה – להצגת ציר התקדמות
export const REQUEST_STEPS = ["הוגשה", "אישור מנהל", 'הקצאה במרלו"ג', "חתימה ומסירה"] as const;

export function requestStepIndex(s: RequestStatus) {
  switch (s) {
    case "PENDING_MANAGER": return 1;
    case "PENDING_WAREHOUSE": return 2;
    case "ALLOCATED": return 3;
    case "FULFILLED": return 4;
    default: return -1; // נדחה / בוטל
  }
}
