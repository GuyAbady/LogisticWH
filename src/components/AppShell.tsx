import Link from "next/link";
import { KeyRound, LogOut, Warehouse } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { NAV } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import type { CurrentUser } from "@/lib/dal";
import { SideNav, BottomNav } from "./NavLinks";

export default function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const items = NAV[user.role];
  return (
    <div className="min-h-dvh md:flex">
      {/* סרגל צד – מחשב */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2">
          <div className="rounded-lg bg-brand-600 p-1.5 text-white"><Warehouse className="size-5" /></div>
          <span className="text-lg font-bold">LogisticWH</span>
        </div>
        <SideNav items={items} />
        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="text-sm font-bold">{user.fullName}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]} · {user.unit.name}</p>
          <Link href="/account" className="mt-2 flex items-center gap-1 text-xs text-brand-700 hover:underline"><KeyRound className="size-3" /> שינוי סיסמה</Link>
          <form action={logout} className="mt-3">
            <button className="btn-secondary w-full"><LogOut className="size-4" /> יציאה</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* כותרת עליונה – נייד */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-brand-600 p-1.5 text-white"><Warehouse className="size-4" /></div>
            <div>
              <p className="text-sm font-bold leading-tight">{user.fullName}</p>
              <p className="text-[11px] text-slate-500">{ROLE_LABELS[user.role]} · {user.unit.name}</p>
            </div>
          </div>
          <div className="flex items-center">
          <Link href="/account" aria-label="שינוי סיסמה" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><KeyRound className="size-5" /></Link>
          <form action={logout}>
            <button aria-label="יציאה" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <LogOut className="size-5" />
            </button>
          </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
