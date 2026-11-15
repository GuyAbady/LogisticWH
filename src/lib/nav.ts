import type { Role } from "@/generated/prisma/enums";

/*
 * ניווט לפי תפקיד. iconName ממופה לאייקון ב-NavLinks (רכיב לקוח) – הקובץ נשאר נתונים בלבד.
 * mobile: מוצג בסרגל התחתון בנייד (עד 4 + כפתור "תפריט" שפותח את כל הניווט).
 * section: כותרת קבוצה בסרגל הצד (למנהל מערכת).
 */
export type NavItem = { href: string; label: string; icon: string; mobile?: boolean; section?: string };

const WAREHOUSE: NavItem[] = [
  { href: "/warehouse", label: "לוח בקרה", icon: "dashboard", mobile: true },
  { href: "/warehouse/issue", label: "ניפוק", icon: "issue", mobile: true },
  { href: "/warehouse/lookup", label: "איתור מהיר", icon: "search", mobile: true },
  { href: "/warehouse/inventory", label: "מלאי", icon: "boxes", mobile: true },
  { href: "/warehouse/requests", label: "דרישות", icon: "clipboard" },
  { href: "/warehouse/returns", label: "החזרות", icon: "undo" },
  { href: "/warehouse/categories", label: "קטגוריות", icon: "tags" },
  { href: "/warehouse/users", label: "משתמשים", icon: "users" },
];

export const NAV: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { href: "/employee", label: "הציוד שלי", icon: "package", mobile: true },
    { href: "/employee/sign", label: "לחתימה", icon: "pen", mobile: true },
    { href: "/employee/requests", label: "הבקשות שלי", icon: "clipboard", mobile: true },
    { href: "/employee/returns", label: "החזרות", icon: "undo", mobile: true },
  ],
  UNIT_MANAGER: [
    { href: "/manager", label: "מצבת היחידה", icon: "users", mobile: true },
    { href: "/manager/requests", label: "אישור בקשות", icon: "clipboard", mobile: true },
    { href: "/manager/bulk", label: "פעולות מרוכזות", icon: "layers", mobile: true },
    { href: "/employee", label: "הציוד שלי", icon: "package", mobile: true },
    { href: "/employee/sign", label: "לחתימה", icon: "pen" },
    { href: "/employee/requests", label: "הבקשות שלי", icon: "clipboard" },
  ],
  WAREHOUSE_MANAGER: WAREHOUSE,
  ADMIN: [
    { href: "/admin", label: "לוח ניהול", icon: "shield", mobile: true, section: "ניהול מערכת" },
    { href: "/admin/import", label: "טעינת עובדים", icon: "upload", section: "ניהול מערכת" },
    { href: "/warehouse/users", label: "משתמשים ויחידות", icon: "users", section: "ניהול מערכת" },
    { href: "/warehouse/categories", label: "קטגוריות", icon: "tags", section: "ניהול מערכת" },
    { href: "/warehouse", label: "לוח בקרה", icon: "dashboard", section: 'מרלו"ג' },
    { href: "/warehouse/issue", label: "ניפוק", icon: "issue", mobile: true, section: 'מרלו"ג' },
    { href: "/warehouse/lookup", label: "איתור מהיר", icon: "search", mobile: true, section: 'מרלו"ג' },
    { href: "/warehouse/inventory", label: "מלאי", icon: "boxes", mobile: true, section: 'מרלו"ג' },
    { href: "/warehouse/requests", label: "דרישות", icon: "clipboard", section: 'מרלו"ג' },
    { href: "/warehouse/returns", label: "החזרות", icon: "undo", section: 'מרלו"ג' },
    { href: "/manager", label: "מצבת יחידה", icon: "users", section: "מנהל יחידה" },
    { href: "/manager/requests", label: "אישור בקשות", icon: "clipboardcheck", section: "מנהל יחידה" },
    { href: "/manager/bulk", label: "פעולות מרוכזות", icon: "layers", section: "מנהל יחידה" },
    { href: "/employee", label: "הציוד שלי", icon: "package", section: "אישי" },
  ],
};
