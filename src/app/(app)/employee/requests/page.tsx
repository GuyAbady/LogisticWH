import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { cancelMyRequest, submitRequest } from "@/app/actions/requests";
import { PageHeader, EmptyState } from "@/components/ui";
import { RequestCard } from "@/components/RequestCard";
import ActionForm from "@/components/ActionForm";

export const metadata: Metadata = { title: "הבקשות שלי" };

export default async function MyRequestsPage() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const [items, requests] = await Promise.all([
    db.catalogItem.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true, sku: true } }),
    db.equipmentRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        catalogItem: { select: { name: true, sku: true, requiresSerial: true } },
        transactions: { where: { signatureId: { not: null } }, select: { signatureId: true }, take: 1 },
      },
    }),
  ]);
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <>
      <PageHeader title="הבקשות שלי" subtitle={user.role === "UNIT_MANAGER" ? 'כמנהל יחידה, בקשותיך עוברות ישירות למרלו"ג' : "בקשה חדשה עוברת לאישור מנהל היחידה ואז למרלו\"ג"} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="card h-fit">
          <h2 className="mb-3 font-bold">בקשת ציוד חדשה</h2>
          <ActionForm action={submitRequest} submitLabel="שליחת בקשה" resetOnSuccess buttonClassName="btn-primary w-full">
            <div>
              <label className="label" htmlFor="catalogItemId">פריט</label>
              <select id="catalogItemId" name="catalogItemId" required className="input" defaultValue="">
                <option value="" disabled>בחר פריט</option>
                {categories.map((c) => (
                  <optgroup key={c} label={c}>
                    {items.filter((i) => i.category === c).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quantity">כמות</label>
              <input id="quantity" name="quantity" type="number" min={1} max={100} defaultValue={1} required className="input" inputMode="numeric" />
            </div>
            <div>
              <label className="label" htmlFor="justification">נימוק (רשות)</label>
              <textarea id="justification" name="justification" rows={2} maxLength={500} className="input" />
            </div>
          </ActionForm>
        </section>

        <section className="space-y-3">
          {requests.length === 0 && <EmptyState text="עדיין לא הוגשו בקשות" />}
          {requests.map((r) => (
            <RequestCard key={r.id} r={r}>
              {r.status === "ALLOCATED" && <Link href={`/employee/sign/${r.id}`} className="btn-accent">לחתימה על קבלת הציוד</Link>}
              {r.status === "FULFILLED" && r.transactions[0]?.signatureId && (
                <Link href={`/receipts/${r.transactions[0].signatureId}`} className="link text-sm">לצפייה בקבלה</Link>
              )}
              {["PENDING_MANAGER", "PENDING_WAREHOUSE"].includes(r.status) && (
                <ActionForm action={cancelMyRequest} submitLabel="ביטול הבקשה" buttonClassName="btn-secondary min-h-9 text-xs" confirmText="לבטל את הבקשה?" className="contents">
                  <input type="hidden" name="requestId" value={r.id} />
                </ActionForm>
              )}
            </RequestCard>
          ))}
        </section>
      </div>
    </>
  );
}
