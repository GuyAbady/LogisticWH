import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { getUserEquipment } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import EquipmentList from "@/components/EquipmentList";

export const metadata: Metadata = { title: "הציוד שלי" };

export default async function EmployeeHome() {
  const user = await requireRole("EMPLOYEE", "UNIT_MANAGER");
  const data = await getUserEquipment(user.id);
  return (
    <>
      <PageHeader title="הציוד החתום עליי" subtitle={`${user.fullName} · מספר עובד ${user.employeeNumber}`} />
      <EquipmentList data={data} />
    </>
  );
}
