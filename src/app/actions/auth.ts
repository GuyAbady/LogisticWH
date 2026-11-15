"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession, readSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { ROLE_HOME } from "@/lib/roles";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("כתובת דוא\"ל לא תקינה"),
  password: z.string().min(1, "יש להזין סיסמה"),
});

export type LoginState = { error?: string; email?: string } | undefined;

const MAX_FAILURES = 5;
const LOCK_WINDOW_MIN = 15;

// hash קבוע להשוואה כשהמשתמש לא קיים – מונע חשיפת קיום משתמש לפי זמן תגובה
const DUMMY_HASH = "$2b$12$uK3n7KGNQr46UIExEPLMOeOxhL/RoxHJt5uU55ikHzKixbu/dAUhi";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const typedEmail = String(formData.get("email") ?? "").slice(0, 200);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: typedEmail };
  const { email, password } = parsed.data;

  // נעילה זמנית אחרי ניסיונות כושלים חוזרים
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000);
  const failures = await db.auditLog.count({
    where: { action: "LOGIN_FAILED", entityId: email, createdAt: { gte: since } },
  });
  if (failures >= MAX_FAILURES) {
    return { error: `יותר מדי ניסיונות כושלים. נסה שוב בעוד ${LOCK_WINDOW_MIN} דקות.`, email: typedEmail };
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.isActive) {
    await audit({ userId: user?.id, action: "LOGIN_FAILED", entity: "User", entityId: email });
    return { error: "דוא\"ל או סיסמה שגויים", email: typedEmail };
  }

  await createSession({ userId: user.id, role: user.role, unitId: user.unitId });
  await audit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id });
  redirect(ROLE_HOME[user.role]);
}

export async function logout() {
  const session = await readSession();
  if (session) await audit({ userId: session.userId, action: "LOGOUT", entity: "User", entityId: session.userId });
  await deleteSession();
  redirect("/login");
}
