import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { xlsxResponse } from "@/lib/excel";
import { buildUserTemplate } from "@/lib/user-import";

// תבנית טעינת עובדים – מנהל מערכת בלבד. נתיבי /api לא עוברים ב-proxy, ההרשאה נבדקת כאן.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  return xlsxResponse(await buildUserTemplate(), "תבנית-טעינת-עובדים.xlsx");
}
