import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import { RequestCard } from "@/components/RequestCard";

export const metadata: Metadata = { title: "ממתין לחתימתי" };

export default async function SignListPage() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const pending = await db.equipmentRequest.findMany({
    where: { requesterId: user.id, status: "ALLOCATED" },
    orderBy: { pickupDate: "asc" },
    include: { catalogItem: { select: { name: true, sku: true, requiresSerial: true } } },
  });
  return (
    <>
      <PageHeader title="ממתין לחתימתי" subtitle='ציוד שהוקצה עבורך במרלו"ג. חתום בעת האיסוף.' />
      {pending.length === 0 ? <EmptyState text="אין ציוד הממתין לחתימה" /> : (
        <div className="space-y-3">
          {pending.map((r) => (
            <RequestCard key={r.id} r={r}>
              <Link href={`/employee/sign/${r.id}`} className="btn-accent">לחתימה</Link>
            </RequestCard>
          ))}
        </div>
      )}
    </>
  );
}
