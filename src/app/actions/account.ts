"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { PasswordSchema } from "@/lib/password";
import type { ActionResult } from "@/lib/action-result";

export async function changeOwnPassword(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireRole();
  const current = String(fd.get("current") ?? "");
  const next = PasswordSchema.safeParse(fd.get("next"));
  if (!next.success) return { error: next.error.issues[0].message };
  if (next.data !== fd.get("confirm")) return { error: "הסיסמאות החדשות אינן תואמות" };
  if (next.data === current) return { error: "הסיסמה החדשה זהה לנוכחית" };

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(current, row.passwordHash))) {
    await audit({ userId: user.id, action: "PASSWORD_CHANGE_FAILED", entity: "User", entityId: user.id });
    return { error: "הסיסמה הנוכחית שגויה" };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next.data, 12) } });
  await audit({ userId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id });
  return { ok: "הסיסמה עודכנה" };
}
