import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { createUnit, createUser, resetUserPassword, setUserActive } from "@/app/actions/admin";
import { PageHeader } from "@/components/ui";
import ActionForm from "@/components/ActionForm";

export const metadata: Metadata = { title: "משתמשים ויחידות" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const me = await requireRole("WAREHOUSE_MANAGER");
  const { unit } = await searchParams;
  const units = await db.unit.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  const unitFilter = units.find((u) => u.id === unit)?.id;
  const users = await db.user.findMany({
    where: unitFilter ? { unitId: unitFilter } : {},
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    include: { unit: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="משתמשים ויחידות" subtitle="הוספת עובדים, מנהלי יחידות ויחידות ארגוניות" />

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card">
          <h2 className="mb-3 font-bold">משתמש חדש</h2>
          <ActionForm action={createUser} submitLabel="צור משתמש" resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="fullName">שם מלא</label><input id="fullName" name="fullName" required className="input" /></div>
            <div><label className="label" htmlFor="employeeNumber">מספר עובד</label><input id="employeeNumber" name="employeeNumber" required className="input ltr" /></div>
            <div><label className="label" htmlFor="email">דוא&quot;ל</label><input id="email" name="email" type="email" required className="input" /></div>
            <div><label className="label" htmlFor="phone">טלפון נייד</label><input id="phone" name="phone" type="tel" required className="input" /></div>
            <div>
              <label className="label" htmlFor="role">תפקיד</label>
              <select id="role" name="role" className="input" defaultValue="EMPLOYEE">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="unitId">יחידה</label>
              <select id="unitId" name="unitId" className="input" required defaultValue={unitFilter ?? ""}>
                <option value="" disabled>בחר יחידה</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="password">סיסמה זמנית</label>
              <input id="password" name="password" required className="input ltr" autoComplete="new-password" />
              <p className="mt-1 text-xs text-slate-500">10 תווים לפחות, כולל אות באנגלית וספרה. העובד יוכל לשנות אותה במסך &quot;שינוי סיסמה&quot;.</p>
            </div>
          </ActionForm>
        </section>

        <section className="card">
          <h2 className="mb-3 font-bold">יחידות</h2>
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            <li><Link href="/warehouse/users" className={`flex justify-between py-1.5 ${!unitFilter ? "font-bold text-brand-700" : ""}`}><span>כל היחידות</span></Link></li>
            {units.map((u) => (
              <li key={u.id}>
                <Link href={`/warehouse/users?unit=${u.id}`} className={`flex justify-between py-1.5 ${u.id === unitFilter ? "font-bold text-brand-700" : ""}`}>
                  <span>{u.name} <span className="ltr inline-block text-xs text-slate-500">{u.code}</span></span>
                  <span className="text-xs text-slate-500">{u._count.users}</span>
                </Link>
              </li>
            ))}
          </ul>
          <ActionForm action={createUnit} submitLabel="הוסף יחידה" resetOnSuccess buttonClassName="btn-secondary w-full">
            <input name="name" required placeholder="שם יחידה" className="input" />
            <input name="code" required placeholder="קוד (אנגלית)" className="input ltr" />
          </ActionForm>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-bold">משתמשים ({users.length})</h2>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-right text-slate-500">
            <tr className="border-b border-slate-200"><th className="py-2">שם</th><th>תפקיד</th><th>יחידה</th><th>יצירת קשר</th><th>פעולות</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-slate-100 align-top ${u.isActive ? "" : "opacity-60"}`}>
                <td className="py-2">
                  <Link href={`/warehouse/lookup/user/${u.id}`} className="font-bold text-brand-700 hover:underline">{u.fullName}</Link>
                  <p className="text-xs text-slate-500">מספר עובד {u.employeeNumber}{!u.isActive && " · לא פעיל"}</p>
                </td>
                <td className="py-2">{ROLE_LABELS[u.role]}</td>
                <td className="py-2">{u.unit.name}</td>
                <td className="py-2 text-xs"><span className="ltr block">{u.email}</span><span className="ltr block">{u.phone}</span></td>
                <td className="py-2">
                  {u.id !== me.id && (
                    <div className="flex flex-wrap gap-2">
                      <ActionForm action={setUserActive} submitLabel={u.isActive ? "השבת" : "הפעל"} className="contents" buttonClassName="btn-secondary px-2 py-1 text-xs"
                        confirmText={u.isActive ? `להשבית את ${u.fullName}? הוא לא יוכל להתחבר.` : undefined}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.isActive)} />
                      </ActionForm>
                      <details>
                        <summary className="btn-secondary cursor-pointer px-2 py-1 text-xs">איפוס סיסמה</summary>
                        <ActionForm action={resetUserPassword} submitLabel="אפס" resetOnSuccess className="mt-2 flex gap-1" buttonClassName="btn-primary px-2 py-1 text-xs">
                          <input type="hidden" name="userId" value={u.id} />
                          <input name="password" required placeholder="סיסמה זמנית" className="input ltr w-36 px-2 py-1 text-xs" autoComplete="new-password" />
                        </ActionForm>
                      </details>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
