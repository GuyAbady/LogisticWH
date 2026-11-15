import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "דרישות מאושרות" };

export default async function Page() {
  await requireRole("WAREHOUSE_MANAGER");
  return <ComingSoon stage={3} title="דרישות מאושרות" bullets={["הקצאת מספר סידורי וקביעת מועד איסוף", "חתימת העובד במעמד האיסוף"]} />;
}
