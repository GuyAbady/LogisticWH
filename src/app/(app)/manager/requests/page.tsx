import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "אישור בקשות ציוד" };

export default async function Page() {
  await requireRole("UNIT_MANAGER");
  return <ComingSoon stage={3} title="אישור בקשות ציוד" bullets={["אישור / דחייה של בקשות עובדי היחידה", "העברה אוטומטית למרלו\"ג לאחר אישור"]} />;
}
