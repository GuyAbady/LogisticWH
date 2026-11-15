import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "החזרות ציוד" };

export default async function Page() {
  await requireRole("EMPLOYEE", "UNIT_MANAGER");
  return <ComingSoon stage={4} title="החזרות ציוד" bullets={["זימונים להחזרת ציוד", "טופסי אישור החזרה (זיכוי)"]} />;
}
