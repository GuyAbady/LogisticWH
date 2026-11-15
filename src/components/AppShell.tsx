import { cookies } from "next/headers";
import { logout } from "@/app/actions/auth";
import { NAV } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import type { CurrentUser } from "@/lib/dal";
import Shell from "./Shell";

export default async function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  // מצב הסרגל נקרא מהעוגייה כבר בשרת – אין קפיצה בטעינה
  const collapsed = (await cookies()).get("lwh_sidebar")?.value === "collapsed";
  return (
    <Shell
      items={NAV[user.role]}
      user={{ fullName: user.fullName, roleLabel: ROLE_LABELS[user.role], unitName: user.unit.name }}
      initialCollapsed={collapsed}
      logout={logout}
    >
      {children}
    </Shell>
  );
}
