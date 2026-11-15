import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "ניהול מלאי" };

export default async function Page() {
  await requireRole("WAREHOUSE_MANAGER");
  return <ComingSoon stage={2} title="ניהול מלאי" bullets={["קליטת מלאי חדש (סידורי וכמותי)", "ניהול מספרים סידוריים", "ייצוא לאקסל (ExcelJS)"]} />;
}
