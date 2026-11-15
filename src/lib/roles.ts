import type { Role } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: "עובד יחידה",
  UNIT_MANAGER: "מנהל יחידה",
  WAREHOUSE_MANAGER: 'מנהל מרלו"ג',
  ADMIN: "מנהל מערכת",
};

// דף הבית של כל תפקיד
export const ROLE_HOME: Record<Role, string> = {
  EMPLOYEE: "/employee",
  UNIT_MANAGER: "/manager",
  WAREHOUSE_MANAGER: "/warehouse",
  ADMIN: "/admin",
};

// קידומות נתיבים מותרות לכל תפקיד. ADMIN – הכל (כולל כל יכולות המרלו"ג ומנהל היחידה).
export const ROLE_PREFIXES: Record<Role, string[]> = {
  EMPLOYEE: ["/employee"],
  UNIT_MANAGER: ["/manager", "/employee"],
  WAREHOUSE_MANAGER: ["/warehouse"],
  ADMIN: ["/admin", "/warehouse", "/manager", "/employee"],
};

export function canAccessPath(role: Role, pathname: string) {
  return ROLE_PREFIXES[role].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** האם התפקיד כולל יכולות מרלו"ג */
export const isWarehouseRole = (role: Role) => role === "WAREHOUSE_MANAGER" || role === "ADMIN";
