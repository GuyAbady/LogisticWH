import { KeyRound } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { changeOwnPassword } from "@/app/actions/account";
import { PageHeader } from "@/components/ui";
import ActionForm from "@/components/ActionForm";

export const metadata = { title: "שינוי סיסמה" };

export default async function AccountPage() {
  const user = await requireRole();
  return (
    <>
      <PageHeader icon={<KeyRound className="size-5" />} title="שינוי סיסמה" subtitle={user.fullName} />
      <div className="card max-w-md">
        <ActionForm action={changeOwnPassword} submitLabel="עדכן סיסמה" resetOnSuccess>
          <div><label className="label" htmlFor="current">סיסמה נוכחית</label><input id="current" name="current" type="password" required autoComplete="current-password" className="input" /></div>
          <div><label className="label" htmlFor="next">סיסמה חדשה</label><input id="next" name="next" type="password" required autoComplete="new-password" className="input" /></div>
          <div><label className="label" htmlFor="confirm">אימות סיסמה חדשה</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input" /></div>
          <p className="text-xs text-slate-500">10 תווים לפחות, כולל אות באנגלית וספרה.</p>
        </ActionForm>
      </div>
    </>
  );
}
