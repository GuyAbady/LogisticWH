import { Building2 } from "lucide-react";
import { db } from "@/lib/db";

/** בחירת יחידה פעילה – מוצג רק למנהל מערכת במסכי מנהל היחידה (טופס GET, עובד גם ללא JavaScript) */
export default async function UnitSwitcher({ current, action }: { current: string; action: string }) {
  const units = await db.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <form action={action} className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
      <Building2 className="size-4 text-sky-800" aria-hidden />
      <label htmlFor="unit-switch" className="text-sm font-bold text-sky-900">פועל כמנהל יחידה עבור:</label>
      <select id="unit-switch" name="unit" defaultValue={current} className="input min-h-9 max-w-xs py-1 text-sm">
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <button className="btn-secondary min-h-9 text-xs">החלפה</button>
    </form>
  );
}
