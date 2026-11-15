import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getUserEquipment } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import EquipmentList from "@/components/EquipmentList";

export const metadata: Metadata = { title: "הציוד שלי" };

export default async function EmployeeHome() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const [data, toSign] = await Promise.all([
    getUserEquipment(user.id),
    db.equipmentRequest.count({ where: { requesterId: user.id, status: "ALLOCATED" } }),
  ]);
  return (
    <>
      <PageHeader title="הציוד החתום עליי" subtitle={`${user.fullName} · מספר עובד ${user.employeeNumber}`} />
      {toSign > 0 && (
        <Link href="/employee/sign" className="mb-6 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-900 hover:bg-violet-100">
          <PenLine className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-bold">{toSign === 1 ? "ציוד אחד ממתין לאיסוף ולחתימתך" : `${toSign} פריטים ממתינים לאיסוף ולחתימתך`}</span>
          <span className="text-sm underline underline-offset-4">לחתימה</span>
        </Link>
      )}
      <EquipmentList data={data} />
    </>
  );
}
