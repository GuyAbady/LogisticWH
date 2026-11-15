"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package, PenLine, ClipboardList, Undo2, Users, Layers, LayoutDashboard, Search, Boxes,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  package: Package, pen: PenLine, clipboard: ClipboardList, undo: Undo2, users: Users,
  layers: Layers, dashboard: LayoutDashboard, search: Search, boxes: Boxes,
};

/** פריט אחד בלבד פעיל: התאמה מדויקת קודמת; אחרת – הקידומת הארוכה ביותר */
export function isActive(pathname: string, href: string, all: NavItem[]) {
  if (all.some((i) => i.href === pathname)) return pathname === href;
  const matches = all.filter((i) => pathname.startsWith(i.href + "/"));
  return matches.length > 0 && matches.sort((a, b) => b.href.length - a.href.length)[0].href === href;
}

/*
 * ניווט אינו מונפש: פעולה שחוזרת עשרות פעמים ביום צריכה להרגיש מיידית
 * (emil-design-eng: "Should this animate at all?").
 */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Package;
        const active = isActive(pathname, item.href, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold ${
              active
                ? "bg-slate-100 text-slate-900 before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-accent-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon className={`size-5 ${active ? "text-accent-600" : ""}`} aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.stage && <span className="badge bg-slate-100 font-normal text-slate-600">בקרוב</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items: all }: { items: NavItem[] }) {
  const pathname = usePathname();
  const items = all.filter((i) => !i.desktopOnly); // עד 5 פריטים בסרגל התחתון (ui-ux-pro-max: Bottom nav ≤5)
  return (
    <nav aria-label="ניווט ראשי" className="fixed inset-x-0 bottom-0 z-20 print:hidden border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? Package;
          const active = isActive(pathname, item.href, all);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-bold ${
                  active
                    ? "text-slate-900 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-accent-600"
                    : "text-slate-500"
                }`}
              >
                <Icon className={`size-[22px] ${active ? "text-accent-600" : ""}`} aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
