import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2, ClipboardCheck, History, LayoutDashboard, PackageOpen, ShieldAlert, ShieldCheck, Tags, Upload, UserCheck, Users, UserX,
} from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { hoursAgo } from "@/lib/dashboard";
import { PageHeader, StatCard, EmptyState, fmtDateTime } from "@/components/ui";
import { ChartCard, RankedBars } from "@/components/charts";

export const metadata: Metadata = { title: "לוח ניהול" };

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "כניסה", LOGIN_FAILED: "כניסה שנכשלה", LOGOUT: "יציאה", USER_CREATE: "יצירת משתמש", USERS_IMPORT: "טעינת עובדים מאקסל",
  USER_DEACTIVATE: "השבתת משתמש", USER_ACTIVATE: "הפעלת משתמש", USER_PASSWORD_RESET: "איפוס סיסמה", PASSWORD_CHANGED: "שינוי סיסמה",
  UNIT_CREATE: "יצירת יחידה", CATEGORY_CREATE: "יצירת קטגוריה", CATEGORY_UPDATE: "עדכון קטגוריה", CATEGORY_DELETE: "מחיקת קטגוריה",
  DIRECT_ISSUE: "ניפוק", RETURN_RECEIVED: "קליטת החזרה", EXPORT: "ייצוא Excel", SETUP_COMPLETED: "הקמה ראשונית",
};

const SHORTCUTS = [
  { href: "/admin/import", label: "טעינת עובדים מאקסל", text: "הוספה ועדכון לפי מספר עובד", icon: Upload },
  { href: "/warehouse/users", label: "משתמשים ויחידות", text: "יצירה, השבתה ואיפוס סיסמה", icon: Users },
  { href: "/warehouse/categories", label: "קטגוריות פריטים", text: "הוספה, שינוי שם ואייקון", icon: Tags },
  { href: "/warehouse/issue", label: "ניפוק ציוד", text: "לעובד או למנהל יחידה", icon: PackageOpen },
  { href: "/warehouse", label: 'לוח בקרה מרלו"ג', text: "מלאי, פעילות ודרישות", icon: LayoutDashboard },
  { href: "/manager/requests", label: "אישור בקשות יחידה", text: "פועל כמנהל יחידה – בחירת יחידה", icon: ClipboardCheck },
];

export default async function AdminHome() {
  await requireRole("ADMIN");
  const since = hoursAgo(24);
  const [byRole, inactive, units, categories, failed, logs] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { isActive: true }, _count: true }),
    db.user.count({ where: { isActive: false } }),
    db.unit.count(),
    db.category.count(),
    db.auditLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since } } }),
    db.auditLog.findMany({ take: 15, orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true } } } }),
  ]);
  const active = byRole.reduce((s, r) => s + r._count, 0);

  return (
    <>
      <PageHeader icon={<ShieldCheck className="size-5" />} title="לוח ניהול מערכת" subtitle="משתמשים, יחידות, קטגוריות ויומן פעולות" />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="משתמשים פעילים" value={active} icon={<UserCheck className="size-4" />} tone="green" href="/warehouse/users" />
        <StatCard label="משתמשים מושבתים" value={inactive} icon={<UserX className="size-4" />} tone="slate" href="/warehouse/users" />
        <StatCard label="יחידות" value={units} icon={<Building2 className="size-4" />} tone="blue" href="/warehouse/users" />
        <StatCard label="קטגוריות" value={categories} icon={<Tags className="size-4" />} tone="violet" href="/warehouse/categories" />
        <StatCard label="כניסות שנכשלו (24 שעות)" value={failed} icon={<ShieldAlert className="size-4" />} tone={failed >= 5 ? "red" : "amber"} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 font-bold">פעולות מהירות</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SHORTCUTS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="card flex items-center gap-3 hover:border-slate-300">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><s.icon className="size-5" aria-hidden /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-900">{s.label}</span>
                    <span className="block text-xs text-slate-600">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <ChartCard icon={<Users className="size-4" />} title="משתמשים פעילים לפי תפקיד">
          <RankedBars rows={(["EMPLOYEE", "UNIT_MANAGER", "WAREHOUSE_MANAGER", "ADMIN"] as const).map((r) => ({ id: r, label: ROLE_LABELS[r], value: byRole.find((b) => b.role === r)?._count ?? 0 }))} />
        </ChartCard>
      </div>

      <ChartCard icon={<History className="size-4" />} title="יומן פעולות אחרונות" subtitle="נשמר לכל כניסה ופעולה רגישה (תקנות הגנת הפרטיות – אבטחת מידע)">
        {logs.length === 0 ? <EmptyState text="אין רשומות" /> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className={`font-bold ${l.action === "LOGIN_FAILED" ? "text-red-800" : ""}`}>{ACTION_LABELS[l.action] ?? l.action}</span>
                  {l.user && <span className="text-slate-600"> · {l.user.fullName}</span>}
                  {l.details && <span className="block text-xs text-slate-500">{l.details}</span>}
                </span>
                <span className="text-xs text-slate-500">{fmtDateTime(l.createdAt)}{l.ipAddress && <> · <span className="ltr inline-block">{l.ipAddress}</span></>}</span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </>
  );
}
