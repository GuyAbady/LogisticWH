import type { Metadata } from "next";
import { FileSpreadsheet, Upload } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { MAX_ROWS } from "@/lib/user-import";
import { PageHeader } from "@/components/ui";
import ImportClient from "./ImportClient";

export const metadata: Metadata = { title: "טעינת עובדים מאקסל" };
// טעינה גדולה כוללת גיבוב סיסמאות – זמן ריצה מרבי לפונקציה (Vercel)
export const maxDuration = 60;

export default async function ImportPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader
        icon={<Upload className="size-5" />}
        title="טעינת עובדים מאקסל"
        subtitle={`הוספה ועדכון של עובדים לפי מספר עובד · עד ${MAX_ROWS} שורות בקובץ`}
        actions={<a href="/api/admin/template" download className="btn-secondary"><FileSpreadsheet className="size-4 text-emerald-700" aria-hidden /> הורדת תבנית</a>}
      />
      <ol className="mb-6 grid gap-3 text-sm sm:grid-cols-3">
        {["הורידו את התבנית ומלאו שורה לכל עובד", "העלו ולחצו \"בדיקה\" – יוצג מה יקרה לכל שורה", "לחצו \"טעינה\" ושמרו את קובץ הסיסמאות הזמניות"].map((t, i) => (
          <li key={t} className="card flex items-center gap-3 p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
      <ImportClient />
    </>
  );
}
