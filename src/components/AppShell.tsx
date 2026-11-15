import Link from "next/link";
import { KeyRound, LogOut, Warehouse } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { NAV } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import type { CurrentUser } from "@/lib/dal";
import { SideNav, BottomNav } from "./NavLinks";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`grid place-items-center rounded-lg bg-brand-600 text-white ${small ? "size-8" : "size-9"}`}>
        <Warehouse className={small ? "size-4" : "size-5"} aria-hidden />
      </div>
      {!small && <span className="text-base font-bold tracking-tight text-slate-900">LogisticWH</span>}
    </div>
  );
}

export default function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const items = NAV[user.role];
  const iconBtn = "grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900";
  return (
    <div className="min-h-dvh md:flex">
      {/* סרגל צד – מחשב */}
      <aside className="sticky top-0 hidden print:hidden h-dvh w-64 shrink-0 flex-col border-l border-slate-200 bg-white px-3 py-5 md:flex">
        <div className="mb-6 px-2"><Logo /></div>
        <SideNav items={items} />
        <div className="mt-auto border-t border-slate-200 px-2 pt-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700" aria-hidden>
              {initials(user.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-600">{ROLE_LABELS[user.role]} · {user.unit.name}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/account" className="btn-secondary min-h-9 flex-1 px-2 text-xs"><KeyRound className="size-3.5" aria-hidden /> סיסמה</Link>
            <form action={logout} className="flex-1">
              <button className="btn-secondary min-h-9 w-full px-2 text-xs"><LogOut className="size-3.5" aria-hidden /> יציאה</button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* כותרת עליונה – נייד */}
        <header className="sticky top-0 z-10 flex print:hidden items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Logo small />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-600">{ROLE_LABELS[user.role]} · {user.unit.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <Link href="/account" aria-label="שינוי סיסמה" className={iconBtn}><KeyRound className="size-5" aria-hidden /></Link>
            <form action={logout}>
              <button aria-label="יציאה" className={iconBtn}><LogOut className="size-5" aria-hidden /></button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10 print:p-0">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
