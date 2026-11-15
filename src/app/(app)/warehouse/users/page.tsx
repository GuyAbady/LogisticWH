import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/generated/prisma/enums";
import { createUnit, createUser, resetUserPassword, setUserActive, updateUser } from "@/app/actions/admin";
import { PageHeader } from "@/components/ui";
import ActionForm from "@/components/ActionForm";

export const metadata: Metadata = { title: "משתמשים ויחידות" };

type EditRow = { id: string; fullName: string; employeeNumber: string; email: string; phone: string; role: Role; unitId: string };

/** טופס עריכת משתמש (רכיב מחוץ לדף – לא נוצר מחדש בכל רינדור) */
function EditUserForm({ u, units, canGrantAdmin }: { u: EditRow; units: { id: string; name: string }[]; canGrantAdmin: boolean }) {
  return (
    <ActionForm action={updateUser} submitLabel="שמירה" className="mt-3 grid gap-2 sm:grid-cols-2" buttonClassName="btn-primary min-h-9 text-xs sm:col-span-2">
      <input type="hidden" name="userId" value={u.id} />
      <label className="text-xs font-bold text-slate-700">שם מלא<input name="fullName" defaultValue={u.fullName} required className="input mt-1 min-h-9 py-1 text-sm" /></label>
      <label className="text-xs font-bold text-slate-700">מספר עובד<input name="employeeNumber" defaultValue={u.employeeNumber} required className="input ltr mt-1 min-h-9 py-1 text-sm" /></label>
      <label className="text-xs font-bold text-slate-700">דוא&quot;ל<input name="email" type="email" defaultValue={u.email} required className="input mt-1 min-h-9 py-1 text-sm" /></label>
      <label className="text-xs font-bold text-slate-700">טלפון<input name="phone" type="tel" defaultValue={u.phone} required className="input mt-1 min-h-9 py-1 text-sm" /></label>
      <label className="text-xs font-bold text-slate-700">תפקיד
        <select name="role" defaultValue={u.role} className="input mt-1 min-h-9 py-1 text-sm">
          {Object.entries(ROLE_LABELS).filter(([k]) => k !== "ADMIN" || canGrantAdmin || u.role === "ADMIN").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">יחידה
        <select name="unitId" defaultValue={u.unitId} className="input mt-1 min-h-9 py-1 text-sm">
          {units.map((un) => <option key={un.id} value={un.id}>{un.name}</option>)}
        </select>
      </label>
    </ActionForm>
  );
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const me = await requireRole("WAREHOUSE_MANAGER");
  const { unit } = await searchParams;
  // תפקיד מנהל מערכת מוצג רק למנהל מערכת, או כשאין עדיין אף מנהל מערכת (אתחול)
  const canGrantAdmin = me.role === "ADMIN" || (await db.user.count({ where: { role: "ADMIN" } })) === 0;
  const units = await db.unit.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  const unitFilter = units.find((u) => u.id === unit)?.id;
  const users = await db.user.findMany({
    where: unitFilter ? { unitId: unitFilter } : {},
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    include: { unit: { select: { name: true } } },
  });

  const meRow = users.find((u) => u.id === me.id) ?? (await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { unit: { select: { name: true } } } }));

  return (
    <>
      <PageHeader icon={<Users className="size-5" />} title="משתמשים ויחידות" subtitle="הוספת עובדים, מנהלי יחידות ויחידות ארגוניות" />
      {me.role === "ADMIN" && (
        <p className="mb-4 text-sm"><Link className="link" href="/admin/import">טעינת רשימת עובדים מקובץ Excel ←</Link></p>
      )}

      {/* החשבון שלי – בראש הדף; כשאין עדיין מנהל מערכת מוצגת הנחיה לקידום עצמי */}
      <section className="card mb-6 border-accent-600/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">החשבון שלי</h2>
            <p className="text-sm text-slate-600">{meRow.fullName} · {ROLE_LABELS[me.role]} · מספר עובד <span className="ltr inline-block">{meRow.employeeNumber}</span></p>
          </div>
        </div>
        {canGrantAdmin && me.role !== "ADMIN" && (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            אין עדיין מנהל מערכת. כדי לקבל את כל הרשאות הניהול – פתחו &quot;עריכה&quot;, בחרו בתפקיד <b>מנהל מערכת</b> ושמרו.
            אין צורך ליצור משתמש נוסף.
          </p>
        )}
        <details className="mt-3" open={canGrantAdmin && me.role !== "ADMIN"}>
          <summary className="btn-secondary min-h-9 px-3 text-xs list-none">עריכת החשבון שלי</summary>
          <EditUserForm u={meRow} units={units} canGrantAdmin={canGrantAdmin} />
        </details>
      </section>

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
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== "ADMIN" || canGrantAdmin).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

      <section>
        <h2 className="mb-3 font-bold">משתמשים ({users.length})</h2>
        {/* כרטיסים במקום טבלה רחבה – כל הפעולות גלויות גם בנייד, בלי גלילה הצידה */}
        <ul className="grid gap-3 lg:grid-cols-2">
          {users.map((u) => (
            <li key={u.id} className={`card ${u.isActive ? "" : "opacity-60"} ${u.id === me.id ? "ring-2 ring-accent-600/40" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/warehouse/lookup/user/${u.id}`} className="link">{u.fullName}</Link>
                  {u.id === me.id && <span className="badge mr-1 bg-accent-50 text-accent-700">אני</span>}
                  <p className="text-xs text-slate-600">מספר עובד <span className="ltr inline-block">{u.employeeNumber}</span> · {u.unit.name}{!u.isActive && " · לא פעיל"}</p>
                </div>
                <span className="badge bg-slate-100 text-slate-700">{ROLE_LABELS[u.role]}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600"><span className="ltr inline-block">{u.email}</span> · <span className="ltr inline-block">{u.phone}</span></p>
              <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
                {(u.role !== "ADMIN" || me.role === "ADMIN") && (
                  <details className="w-full">
                    <summary className="btn-secondary min-h-9 px-3 text-xs list-none">עריכה{u.id === me.id && " (החשבון שלי)"}</summary>
                    <EditUserForm u={u} units={units} canGrantAdmin={canGrantAdmin} />
                  </details>
                )}
                {u.id !== me.id && (
                  <>
                    <ActionForm action={setUserActive} submitLabel={u.isActive ? "השבת" : "הפעל"} className="contents" buttonClassName="btn-secondary min-h-9 px-3 text-xs"
                      confirmText={u.isActive ? `להשבית את ${u.fullName}? הוא לא יוכל להתחבר.` : undefined}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={String(!u.isActive)} />
                    </ActionForm>
                    <details>
                      <summary className="btn-secondary min-h-9 px-3 text-xs list-none">איפוס סיסמה</summary>
                      <ActionForm action={resetUserPassword} submitLabel="אפס" resetOnSuccess className="mt-2 flex gap-1" buttonClassName="btn-primary min-h-9 px-2.5 text-xs">
                        <input type="hidden" name="userId" value={u.id} />
                        <input name="password" required placeholder="סיסמה זמנית" aria-label="סיסמה זמנית" className="input ltr min-h-9 w-36 px-2 py-1 text-xs" autoComplete="new-password" />
                      </ActionForm>
                    </details>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
