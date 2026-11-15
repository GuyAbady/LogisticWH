import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { actingUnit, requireRole } from "@/lib/dal";
import UnitSwitcher from "@/components/UnitSwitcher";
import { db } from "@/lib/db";
import { decideRequest } from "@/app/actions/requests";
import { PageHeader, EmptyState } from "@/components/ui";
import { RequestCard } from "@/components/RequestCard";
import ActionForm from "@/components/ActionForm";

export const metadata: Metadata = { title: "אישור בקשות" };

const include = {
  catalogItem: { select: { name: true, sku: true, requiresSerial: true } },
  requester: { select: { fullName: true, employeeNumber: true } },
} as const;

export default async function ManagerRequestsPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const user = await requireRole("UNIT_MANAGER");
  const unit = await actingUnit(user, (await searchParams).unit);
  // סינון לפי יחידת המנהל בשרת בלבד
  const [pending, recent] = await Promise.all([
    db.equipmentRequest.findMany({ where: { unitId: unit.id, status: "PENDING_MANAGER" }, orderBy: { createdAt: "asc" }, include }),
    db.equipmentRequest.findMany({ where: { unitId: unit.id, status: { not: "PENDING_MANAGER" } }, orderBy: { updatedAt: "desc" }, take: 20, include }),
  ]);

  return (
    <>
      <PageHeader icon={<ClipboardCheck className="size-5" />} title={`אישור בקשות – ${unit.name}`} subtitle={`${pending.length} בקשות ממתינות להחלטתך`} />
      {user.role === "ADMIN" && <UnitSwitcher current={unit.id} action="/manager/requests" />}
      <section className="mb-8 space-y-3">
        {pending.length === 0 && <EmptyState text="אין בקשות ממתינות" />}
        {pending.map((r) => (
          <RequestCard key={r.id} r={r} showRequester>
            <ActionForm action={decideRequest} submitLabel="אישור והעברה למרלו״ג" buttonClassName="btn-accent" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="requestId" value={r.id} />
              <input type="hidden" name="decision" value="approve" />
              <input name="note" placeholder="הערה (רשות)" aria-label="הערה לאישור" className="input max-w-xs flex-1" maxLength={300} />
            </ActionForm>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-red-700">דחיית הבקשה</summary>
              <ActionForm action={decideRequest} submitLabel="דחייה" buttonClassName="btn-danger" className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="requestId" value={r.id} />
                <input type="hidden" name="decision" value="reject" />
                <input name="note" required placeholder="סיבת הדחייה (חובה)" aria-label="סיבת הדחייה" className="input max-w-xs flex-1" maxLength={300} />
              </ActionForm>
            </details>
          </RequestCard>
        ))}
      </section>

      <h2 className="mb-3 font-bold">החלטות ובקשות אחרונות</h2>
      <section className="space-y-3">
        {recent.length === 0 && <EmptyState text="אין היסטוריה" />}
        {recent.map((r) => <RequestCard key={r.id} r={r} showRequester />)}
      </section>
    </>
  );
}
