import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAssignments, getHistory } from "@/lib/reports";
import { ROLE_LABELS } from "@/lib/roles";
import { PageHeader, StatCard } from "@/components/ui";
import { AssignmentTable, ExportButton, HistoryList } from "@/components/data";

export const metadata = { title: "תיק ציוד עובד" };

export default async function UserFolder({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("WAREHOUSE_MANAGER");
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, include: { unit: true } });
  if (!user) notFound();
  const [rows, history] = await Promise.all([getAssignments({ userId: id }), getHistory({ userId: id }, 100)]);
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
      <section className="card">
        <h2 className="mb-3 font-bold">היסטוריית תנועות (100 אחרונות)</h2>
        <HistoryList items={history} />
      </section>
    </>
  );
}
