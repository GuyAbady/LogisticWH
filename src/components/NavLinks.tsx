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

function isActive(pathname: string, href: string, all: NavItem[]) {
  if (pathname === href) return true;
  // מסמן את הפריט הספציפי ביותר שמתאים לנתיב
  const matches = all.filter((i) => pathname.startsWith(i.href + "/"));
  return matches.length > 0 && matches.sort((a, b) => b.href.length - a.href.length)[0].href === href;
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Package;
        const active = isActive(pathname, item.href, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
              active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon className="size-5" />
            <span className="flex-1">{item.label}</span>
            {item.stage && (
              <span className={`badge ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                שלב {item.stage}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? Package;
          const active = isActive(pathname, item.href, items);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${
                  active ? "text-brand-600" : "text-slate-500"
                }`}
              >
                <Icon className="size-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
