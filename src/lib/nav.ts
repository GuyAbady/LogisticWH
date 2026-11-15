import type { Role } from "@/generated/prisma/enums";

// iconName ממופה לאייקון ב-NavLinks (רכיב לקוח) – כדי שקובץ זה יישאר נתונים בלבד
export type NavItem = { href: string; label: string; icon: string; stage?: number };

export const NAV: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { href: "/employee", label: "הציוד שלי", icon: "package" },
    { href: "/employee/sign", label: "לחתימה", icon: "pen", stage: 3 },
    { href: "/employee/requests", label: "הבקשות שלי", icon: "clipboard", stage: 3 },
    { href: "/employee/returns", label: "החזרות", icon: "undo", stage: 4 },
  ],
  UNIT_MANAGER: [
    { href: "/manager", label: "מצבת היחידה", icon: "users" },
    { href: "/manager/requests", label: "אישור בקשות", icon: "clipboard", stage: 3 },
    { href: "/manager/bulk", label: "פעולות מרוכזות", icon: "layers", stage: 4 },
    { href: "/employee", label: "הציוד שלי", icon: "package" },
  ],
  WAREHOUSE_MANAGER: [
    { href: "/warehouse", label: "לוח בקרה", icon: "dashboard" },
    { href: "/warehouse/lookup", label: "איתור מהיר", icon: "search", stage: 2 },
    { href: "/warehouse/inventory", label: "מלאי", icon: "boxes", stage: 2 },
    { href: "/warehouse/requests", label: "דרישות", icon: "clipboard", stage: 3 },
    { href: "/warehouse/returns", label: "החזרות", icon: "undo", stage: 4 },
  ],
};
