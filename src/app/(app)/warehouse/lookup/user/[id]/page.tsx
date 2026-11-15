import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAssignments, getHistory } from "@/lib/reports";
import { ROLE_LABELS } from "@/lib/roles";
import { PageHeader, StatCard } from "@/components/ui";
import { AssignmentTable, ExportButton, HistoryList } from "@/components/data";
import ActionForm from "@/components/ActionForm";
import { createSummonsAction } from "@/app/actions/returns";
import Link from "next/link";

export const metadata = { title: "תיק ציוד עובד" };

export default async function UserFolder({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, include: { unit: true } });
  if (!user) notFound();
  const [rows, history, openSummons] = await Promise.all([
    getAssignments({ userId: id }),
    getHistory({ userId: id }, 100),
    db.returnSummons.findMany({ where: { userId: id, status: "PENDING_RETURN" }, include: { catalogItem: true, serial: true } }),
  ]);
  // פריטים שניתן לזמן: סידורי חתום (לא כבר זומן / ממתין לאישור), או כמותי עם יתרה
  const summonable = rows.filter((r) => (r.kind === "SERIAL" ? r.serialStatus === "SIGNED" : r.quantity > 0));
  const serialCount = rows.filter((r) => r.kind === "SERIAL").length;
  const qty = rows.filter((r) => r.kind === "QUANTITY").reduce((s, r) => s + r.quantity, 0);

  return (
    <>
      <PageHeader
        title={`תיק ציוד – ${user.fullName}`}
        subtitle={`${ROLE_LABELS[user.role]} · ${user.unit.name} · מספר עובד ${user.employeeNumber}${user.isActive ? "" : " · לא פעיל"}`}
        actions={<ExportButton report="user" id={user.id} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="פריטים סידוריים" value={serialCount} />
        <StatCard label="יחידות כמותיות" value={qty} />
        <StatCard label="טלפון" value={<span className="ltr inline-block text-lg">{user.phone}</span>} />
        <StatCard label='דוא"ל' value={<span className="ltr inline-block break-all text-sm">{user.email}</span>} />
      </div>
      <section className="card mb-6">
        <h2 className="mb-3 font-bold">ציוד רשום כעת</h2>
        <AssignmentTable rows={rows} show={{ item: true }} />
      </section>
      <section className="card mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">זימון להחזרת ציוד</h2>
          {openSummons.length > 0 && (
            <Link className="link text-sm" href={`/warehouse/returns?user=${user.id}`}>{openSummons.length} זימונים פתוחים · לקליטת החזרה</Link>
          )}
        </div>
        {summonable.length === 0 ? <p className="text-sm text-slate-600">אין פריטים שניתן לזמן.</p> : (
          <ActionForm action={createSummonsAction} submitLabel="שליחת זימון לעובד" resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="userId" value={user.id} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="item">פריט</label>
              <select id="item" name="item" required defaultValue="" className="input">
                <option value="" disabled>בחר פריט</option>
                {summonable.map((r) => (
                  <option key={r.serialId ?? r.catalogItemId} value={r.kind === "SERIAL" ? `s:${r.serialId}` : `q:${r.catalogItemId}`}>
                    {r.itemName} {r.kind === "SERIAL" ? `· ${r.serialNumber}` : `· כמות ברשותו ${r.quantity}`}
                  </option>
                ))}
              </select>
            </div>
            <div><label className="label" htmlFor="quantity">כמות (לפריט כמותי)</label><input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="input" /></div>
            <div><label className="label" htmlFor="dueDate">להחזיר עד (רשות)</label><input id="dueDate" name="dueDate" type="date" className="input" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="reason">סיבה</label><input id="reason" name="reason" required maxLength={300} className="input" placeholder="סיום תפקיד / החלפה / בדיקה תקופתית" /></div>
          </ActionForm>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">היסטוריית תנועות (100 אחרונות)</h2>
        <HistoryList items={history} />
      </section>
    </>
  );
}
