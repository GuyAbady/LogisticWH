import { requireRole } from "@/lib/dal";
import { ComingSoon } from "@/components/ui";

export const metadata = { title: "איתור מהיר" };

export default async function Page() {
  await requireRole("WAREHOUSE_MANAGER");
  return <ComingSoon stage={2} title="איתור מהיר" bullets={["חיפוש לפי עובד / יחידה – תיק ציוד מלא", "חיפוש לפי מק\"ט / מספר סידורי – היכן הפריט נמצא", "היסטוריית החזקה מלאה מיומן התנועות"]} />;
}
