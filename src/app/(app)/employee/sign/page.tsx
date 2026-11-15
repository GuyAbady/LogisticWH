import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "ממתין לחתימתי" };

export default async function Page() {
  await requireRole("EMPLOYEE", "UNIT_MANAGER");
  return <ComingSoon stage={3} title="ממתין לחתימתי" bullets={["חתימה דיגיטלית במסך מגע על ציוד שהוקצה לך", "קבלה דיגיטלית למייל ולנייד"]} />;
}
