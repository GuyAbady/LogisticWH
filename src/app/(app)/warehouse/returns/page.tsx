import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "זימוני החזרה" };

export default async function Page() {
  await requireRole("WAREHOUSE_MANAGER");
  return <ComingSoon stage={4} title="זימוני החזרה" bullets={["זימון החזרה לעובד", "קליטה למלאי והפקת טופס אישור החזרה"]} />;
}
