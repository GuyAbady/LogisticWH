import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "הבקשות שלי" };

export default async function Page() {
  await requireRole("EMPLOYEE", "UNIT_MANAGER");
  return <ComingSoon stage={3} title="הבקשות שלי" bullets={["פתיחת בקשה לציוד חדש", "מעקב סטטוס: מנהל יחידה ← מרלו\"ג ← איסוף"]} />;
}
