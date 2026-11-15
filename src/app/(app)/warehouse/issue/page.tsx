import type { Metadata } from "next";
import Link from "next/link";
import { Info, PackageOpen, Search, UserRound } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ISSUE_TO_MANAGER_TERMS, DOC_TERMS } from "@/lib/receipt";
import { ROLE_LABELS } from "@/lib/roles";
import { issueAction } from "@/app/actions/issue";
import { PageHeader, EmptyState } from "@/components/ui";
import ActionForm from "@/components/ActionForm";
import SignatureField from "@/components/SignatureField";
import ScanButton from "@/components/ScanButton";
import ItemIcon from "@/components/ItemIcon";

export const metadata: Metadata = { title: "ניפוק ציוד" };

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ unit?: string; q?: string; user?: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { unit = "", q = "", user: userId } = await searchParams;
  const term = q.trim().slice(0, 60);

  const units = await db.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const searching = Boolean(unit || term);
  const candidates = searching
    ? await db.user.findMany({
        where: {
          isActive: true,
          ...(unit ? { unitId: unit } : {}),
          ...(term ? { OR: [{ fullName: { contains: term, mode: "insensitive" } }, { employeeNumber: { contains: term } }] } : {}),
        },
        orderBy: { fullName: "asc" },
        take: 50,
        select: { id: true, fullName: true, employeeNumber: true, role: true, unit: { select: { name: true } } },
      })
    : [];

  const recipient = userId
    ? await db.user.findFirst({
        where: { id: userId, isActive: true },
        include: { unit: true, _count: { select: { serialItems: true } } },
      })
    : null;

  const items = recipient
    ? await db.catalogItem.findMany({
        where: { isActive: true, availableQty: { gt: 0 } },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        include: {
          categoryRef: { select: { icon: true } },
          serials: { where: { status: "IN_STOCK", holderId: null }, orderBy: { serialNumber: "asc" }, take: 200, select: { id: true, serialNumber: true } },
        },
      })
    : [];
  const keep = new URLSearchParams({ ...(unit ? { unit } : {}), ...(term ? { q: term } : {}) }).toString();
  const toManager = recipient?.role === "UNIT_MANAGER";

  return (
    <>
      <PageHeader icon={<PackageOpen className="size-5" />} title="ניפוק ציוד" subtitle="ניפוק ישיר לעובד או למנהל יחידה, עם חתימת המקבל במקום" />

      {/* שלב 1: איתור מקבל */}
      <section className="card mb-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><span className="grid size-6 place-items-center rounded-full bg-brand-600 text-xs text-white">1</span> בחירת מקבל</h2>
        <form className="flex flex-wrap gap-2" action="/warehouse/issue">
          <select name="unit" defaultValue={unit} aria-label="יחידה" className="input max-w-[14rem]">
            <option value="">כל היחידות</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input id="issue-q" name="q" defaultValue={term} placeholder="שם או מספר עובד" aria-label="שם או מספר עובד" className="input max-w-xs flex-1" />
          <button className="btn-primary"><Search className="size-4" aria-hidden /> חיפוש</button>
        </form>
        {searching && (
          candidates.length === 0 ? <div className="mt-3"><EmptyState text="לא נמצאו עובדים פעילים" /></div> : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/warehouse/issue?${keep}${keep ? "&" : ""}user=${c.id}`}
                    aria-current={c.id === recipient?.id ? "true" : undefined}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${c.id === recipient?.id ? "border-accent-600 bg-accent-50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <UserRound className="size-5 shrink-0 text-slate-500" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{c.fullName} <span className="font-normal text-slate-500">({c.employeeNumber})</span></span>
                      <span className="block truncate text-xs text-slate-600">{ROLE_LABELS[c.role]} · {c.unit.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {/* שלב 2: פריטים + חתימה */}
      {recipient && (
        <ActionForm action={issueAction} submitLabel={`ניפוק וחתימה – ${recipient.fullName}`} pendingLabel="מנפק..." buttonClassName="btn-accent w-full py-3 text-base sm:w-auto">
          <input type="hidden" name="recipientId" value={recipient.id} />
          <section className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-bold"><span className="grid size-6 place-items-center rounded-full bg-brand-600 text-xs text-white">2</span> פריטים לניפוק ל{recipient.fullName}</h2>
              <ScanButton mode="check" label="סריקת פריטים" />
            </div>
            {toManager && (
              <p className="mb-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                ניפוק למנהל יחידה לצורך חלוקה לעובדיו. אחרי הניפוק המנהל מחלק במסך &quot;פעולות מרוכזות&quot;, והעובדים מאשרים בנייד.
              </p>
            )}
            {items.length === 0 ? <EmptyState text="אין מלאי זמין במחסן" /> : (
              <ul className="divide-y divide-slate-100">
                {items.map((i) => (
                  <li key={i.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <ItemIcon name={i.name} category={i.category} iconKey={i.categoryRef.icon} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{i.name}</span>
                        <span className="text-xs text-slate-600">{i.category} · {i.availableQty} במחסן</span>
                      </span>
                      {!i.requiresSerial && (
                        <label className="flex items-center gap-2 text-sm">
                          כמות
                          <input name={`qty:${i.id}`} type="number" min={0} max={i.availableQty} defaultValue={0} inputMode="numeric" className="input min-h-9 w-24" aria-label={`כמות ${i.name}`} />
                        </label>
                      )}
                    </div>
                    {i.requiresSerial && (
                      <details className="mt-2 ms-10">
                        <summary className="cursor-pointer text-sm text-slate-700">בחירת מספרים סידוריים ({i.serials.length} זמינים)</summary>
                        <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-4">
                          {i.serials.map((s) => (
                            <label key={s.id} className="flex min-h-9 items-center gap-2 rounded px-1 text-sm hover:bg-slate-50">
                              <input type="checkbox" name="serialIds" value={s.id} data-scan={s.serialNumber} className="size-4" />
                              <span className="ltr font-mono">{s.serialNumber}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><span className="grid size-6 place-items-center rounded-full bg-brand-600 text-xs text-white">3</span> חתימת המקבל</h2>
            <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{toManager ? ISSUE_TO_MANAGER_TERMS : DOC_TERMS.ISSUE}</p>
            <div className="max-w-md"><SignatureField /></div>
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-bold">
              <input type="checkbox" name="agree" required className="size-5" /> {recipient.fullName} קרא/ה ומאשר/ת את קבלת הציוד
            </label>
          </section>
        </ActionForm>
      )}
    </>
  );
}
