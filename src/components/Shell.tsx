"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes, ClipboardCheck, ClipboardList, Ellipsis, KeyRound, Layers, LayoutDashboard, LogOut, Menu, Package,
  PackageOpen, PanelRightClose, PanelRightOpen, PenLine, Search, ShieldCheck, Tags, Undo2, Upload, Users, Warehouse, X,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

/*
 * מעטפת האפליקציה (לקוח):
 * - סרגל צד ימני שניתן לכווץ לפס אייקונים; הבחירה נשמרת בעוגייה (השרת מרנדר מיד במצב הנכון – ללא קפיצה).
 *   ללא אנימציית רוחב: הנפשת width מחשבת layout בכל פריים (animation-performance) – והפעולה צריכה להרגיש מיידית.
 * - בנייד: סרגל תחתון (עד 4 פריטים + "עוד") ומגירת ניווט מלאה מכפתור התפריט.
 */

const ICONS: Record<string, LucideIcon> = {
  package: Package, pen: PenLine, clipboard: ClipboardList, clipboardcheck: ClipboardCheck, undo: Undo2, users: Users,
  layers: Layers, dashboard: LayoutDashboard, search: Search, boxes: Boxes, issue: PackageOpen, tags: Tags,
  shield: ShieldCheck, upload: Upload,
};

const COOKIE = "lwh_sidebar";

/** פריט אחד בלבד פעיל: התאמה מדויקת קודמת; אחרת – הקידומת הארוכה ביותר */
export function isActive(pathname: string, href: string, all: NavItem[]) {
  if (all.some((i) => i.href === pathname)) return pathname === href;
  const matches = all.filter((i) => pathname.startsWith(i.href + "/"));
  return matches.length > 0 && matches.sort((a, b) => b.href.length - a.href.length)[0].href === href;
}

type UserInfo = { fullName: string; roleLabel: string; unitName: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
}

function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-0.5">
      {items.map((item, idx) => {
        const Icon = ICONS[item.icon] ?? Package;
        const active = isActive(pathname, item.href, items);
        const header = item.section && item.section !== items[idx - 1]?.section ? item.section : null;
        return (
          <div key={item.href}>
            {header &&
              (collapsed ? (
                <hr className="mx-2 my-2 border-slate-200" />
              ) : (
                <p className="mt-3 mb-1 px-3 text-xs font-bold text-slate-500 first:mt-0">{header}</p>
              ))}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-lg text-sm font-bold ${collapsed ? "justify-center px-0" : "px-3"} ${
                active
                  ? "bg-slate-100 text-slate-900 before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-accent-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`size-5 shrink-0 ${active ? "text-accent-600" : ""}`} aria-hidden />
              {!collapsed && <span className="flex-1">{item.label}</span>}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function UserBlock({ user, collapsed, logout }: { user: UserInfo; collapsed?: boolean; logout: () => Promise<void> }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="grid size-9 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700" title={`${user.fullName} · ${user.roleLabel}`} aria-hidden>
          {initials(user.fullName)}
        </div>
        <Link href="/account" title="שינוי סיסמה" aria-label="שינוי סיסמה" className="grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <KeyRound className="size-4" aria-hidden />
        </Link>
        <form action={logout}>
          <button title="יציאה" aria-label="יציאה" className="grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700" aria-hidden>
          {initials(user.fullName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
          <p className="truncate text-xs text-slate-600">{user.roleLabel} · {user.unitName}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link href="/account" className="btn-secondary min-h-9 flex-1 px-2 text-xs"><KeyRound className="size-3.5" aria-hidden /> סיסמה</Link>
        <form action={logout} className="flex-1">
          <button className="btn-secondary min-h-9 w-full px-2 text-xs"><LogOut className="size-3.5" aria-hidden /> יציאה</button>
        </form>
      </div>
    </>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`grid shrink-0 place-items-center rounded-lg bg-brand-600 text-white ${small ? "size-8" : "size-9"}`}>
        <Warehouse className={small ? "size-4" : "size-5"} aria-hidden />
      </div>
      {!small && <span className="text-base font-bold tracking-tight text-slate-900">LogisticWH</span>}
    </div>
  );
}

export default function Shell({
  items, user, initialCollapsed, logout, children,
}: { items: NavItem[]; user: UserInfo; initialCollapsed: boolean; logout: () => Promise<void>; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);
  const hasMore = items.length > mobileItems.length;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const iconBtn = "grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  return (
    <div className="min-h-dvh md:flex">
      {/* סרגל צד – מחשב */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white py-4 print:hidden md:flex ${collapsed ? "w-[4.5rem] px-2" : "w-64 px-3"}`}
        aria-label="סרגל צד"
      >
        <div className={`mb-5 flex items-center ${collapsed ? "flex-col gap-2" : "justify-between px-2"}`}>
          <Logo small={collapsed} />
          <button
            type="button"
            onClick={toggle}
            className={iconBtn}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "הרחבת סרגל הצד" : "כיווץ סרגל הצד"}
            title={collapsed ? "הרחבת סרגל הצד" : "כיווץ סרגל הצד"}
          >
            {collapsed ? <PanelRightOpen className="size-5" aria-hidden /> : <PanelRightClose className="size-5" aria-hidden />}
          </button>
        </div>
        <NavList items={items} collapsed={collapsed} />
        <div className={`mt-auto border-t border-slate-200 pt-4 ${collapsed ? "" : "px-2"}`}>
          <UserBlock user={user} collapsed={collapsed} logout={logout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* כותרת – נייד */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-2 print:hidden md:hidden">
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" onClick={() => setDrawer(true)} className={iconBtn} aria-label="פתיחת תפריט" aria-expanded={drawer}>
              <Menu className="size-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-600">{user.roleLabel} · {user.unitName}</p>
            </div>
          </div>
          <Logo small />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10 print:p-0">{children}</main>
      </div>

      {/* מגירת ניווט – נייד */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="תפריט ניווט">
          <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="סגירת תפריט" onClick={() => setDrawer(false)} />
          <div className="drawer-enter absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-3 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <Logo />
              <button type="button" onClick={() => setDrawer(false)} className={iconBtn} aria-label="סגירה"><X className="size-5" aria-hidden /></button>
            </div>
            <NavList items={items} onNavigate={() => setDrawer(false)} />
            <div className="mt-auto border-t border-slate-200 px-1 pt-4">
              <UserBlock user={user} logout={logout} />
            </div>
          </div>
        </div>
      )}

      {/* סרגל תחתון – נייד */}
      <nav aria-label="ניווט מהיר" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] print:hidden md:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))` }}>
          {mobileItems.map((item) => {
            const Icon = ICONS[item.icon] ?? Package;
            const active = isActive(pathname, item.href, items);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-bold ${
                    active ? "text-slate-900 before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-accent-600" : "text-slate-500"
                  }`}
                >
                  <Icon className={`size-[22px] ${active ? "text-accent-600" : ""}`} aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {hasMore && (
            <li>
              <button type="button" onClick={() => setDrawer(true)} className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-xs font-bold text-slate-500">
                <Ellipsis className="size-[22px]" aria-hidden />
                עוד
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
