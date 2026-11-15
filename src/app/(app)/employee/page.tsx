import type { Metadata } from "next";
import Link from "next/link";
import { PackageCheck, PenLine, Undo2 } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getUserEquipment } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import EquipmentList from "@/components/EquipmentList";

export const metadata: Metadata = { title: "הציוד שלי" };

export default async function EmployeeHome() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const [data, toSign, toAck, summons] = await Promise.all([
    getUserEquipment(user.id),
    db.equipmentRequest.count({ where: { requesterId: user.id, status: "ALLOCATED" } }),
    db.transaction.count({ where: { toUserId: user.id, type: "TRANSFER", requiresAck: true, ackAt: null } }),
    db.returnSummons.count({ where: { userId: user.id, status: "PENDING_RETURN" } }),
  ]);
  const signTotal = toSign + toAck;
  return (
    <>
      <PageHeader icon={<PackageCheck className="size-5" />} title="הציוד החתום עליי" subtitle={`${user.fullName} · מספר עובד ${user.employeeNumber}`} />
      {signTotal > 0 && (
        <Link href="/employee/sign" className="mb-3 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-900 hover:bg-violet-100">
          <PenLine className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-bold">{signTotal === 1 ? "פריט אחד ממתין לחתימתך" : `${signTotal} פריטים ממתינים לחתימתך`}</span>
          <span className="text-sm underline underline-offset-4">לחתימה</span>
        </Link>
      )}
      {summons > 0 && (
        <Link href="/employee/returns" className="mb-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 hover:bg-red-100">
          <Undo2 className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-bold">{summons === 1 ? "זומנת להחזיר פריט" : `זומנת להחזיר ${summons} פריטים`}</span>
          <span className="text-sm underline underline-offset-4">לפרטים</span>
        </Link>
      )}
      {(signTotal > 0 || summons > 0) && <div className="mb-3" />}
      <EquipmentList data={data} />
    </>
  );
}
