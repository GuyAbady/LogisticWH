import type { Role } from "@/generated/prisma/enums";

// iconName ממופה לאייקון ב-NavLinks (רכיב לקוח) – כדי שקובץ זה יישאר נתונים בלבד
export type NavItem = { href: string; label: string; icon: string; stage?: number; desktopOnly?: boolean };

export const NAV: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { href: "/employee", label: "הציוד שלי", icon: "package" },
    { href: "/employee/sign", label: "לחתימה", icon: "pen" },
    { href: "/employee/requests", label: "הבקשות שלי", icon: "clipboard" },
    { href: "/employee/returns", label: "החזרות", icon: "undo" },
  ],
  UNIT_MANAGER: [
    { href: "/manager", label: "מצבת היחידה", icon: "users" },
    { href: "/manager/requests", label: "אישור בקשות", icon: "clipboard" },
    { href: "/manager/bulk", label: "פעולות מרוכזות", icon: "layers" },
    { href: "/employee", label: "הציוד שלי", icon: "package" },
  ],
  WAREHOUSE_MANAGER: [
    { href: "/warehouse", label: "לוח בקרה", icon: "dashboard" },
    { href: "/warehouse/lookup", label: "איתור מהיר", icon: "search" },
    { href: "/warehouse/inventory", label: "מלאי", icon: "boxes" },
    { href: "/warehouse/requests", label: "דרישות", icon: "clipboard" },
    { href: "/warehouse/returns", label: "החזרות", icon: "undo" },
    { href: "/warehouse/users", label: "משתמשים", icon: "users", desktopOnly: true },
  ],
};
