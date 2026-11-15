import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Warehouse } from "lucide-react";
import { isSetupOpen } from "@/lib/setup";
import SetupForm from "./SetupForm";

export const metadata: Metadata = { title: "הקמה ראשונית", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // הדף נסגר אוטומטית ברגע שקיים משתמש כלשהו, או כש-SETUP_TOKEN אינו מוגדר
  if (!(await isSetupOpen())) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-brand-600 p-3 text-white"><Warehouse className="size-8" /></div>
          <h1 className="text-2xl font-bold">הקמה ראשונית – LogisticWH</h1>
          <p className="text-sm text-slate-600">
            יצירת מנהל המרלו&quot;ג הראשון. הדף ייסגר אוטומטית לאחר היצירה.
          </p>
        </div>
        <div className="card"><SetupForm /></div>
        <p className="mt-4 text-center text-xs text-slate-500">
          לאחר ההקמה מומלץ למחוק את המשתנה SETUP_TOKEN מ-Vercel.
        </p>
      </div>
    </main>
  );
}
