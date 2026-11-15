import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "פעולות מרוכזות" };

export default async function Page() {
  await requireRole("UNIT_MANAGER");
  return <ComingSoon stage={4} title="פעולות מרוכזות" bullets={["החתמה מרוכזת בחתימת מנהל אחת – העובד מאשר בנייד", "זיכוי מרוכז למספר עובדים"]} />;
}
