"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { setupTokenConfigured, setupTokenMatches } from "@/lib/setup";

/*
 * הקמה ראשונית: יצירת מנהל מרלו"ג ראשון כשאין אף משתמש במערכת.
 * שכבות הגנה:
 *  1. פעיל רק אם SETUP_TOKEN מוגדר (16 תווים לפחות) – אחרת כבוי לגמרי.
 *  2. השוואת קוד בזמן קבוע (timingSafeEqual) – מונע ניחוש לפי זמן תגובה.
 *  3. חסימה אחרי 5 ניסיונות כושלים ב-15 דקות (לפי AuditLog).
 *  4. נעילת PostgreSQL (advisory lock) + בדיקה חוזרת שאין משתמשים בתוך הטרנזקציה –
 *     מונע יצירת שני מנהלים בשתי בקשות מקבילות.
 */

const MAX_FAILURES = 5;
const WINDOW_MIN = 15;
const SETUP_LOCK_KEY = 7_331_001; // מזהה קבוע לנעילת ההקמה

const SetupSchema = z
  .object({
    token: z.string().min(1, "יש להזין קוד הקמה"),
    unitName: z.string().trim().min(2, "שם יחידה קצר מדי").max(80),
    unitCode: z.string().trim().min(1, "יש להזין קוד יחידה").max(20).regex(/^[A-Za-z0-9_-]+$/, "קוד יחידה: אותיות באנגלית, ספרות, - או _ בלבד"),
    fullName: z.string().trim().min(2, "שם מלא קצר מדי").max(80),
    employeeNumber: z.string().trim().min(1, "יש להזין מספר עובד").max(20),
    email: z.string().trim().toLowerCase().email('כתובת דוא"ל לא תקינה'),
    phone: z.string().trim().regex(/^[0-9+\-\s]{9,15}$/, "מספר טלפון לא תקין"),
    password: z
      .string()
      .min(10, "סיסמה: 10 תווים לפחות")
      .regex(/[A-Za-z]/, "סיסמה: חייבת לכלול אות")
      .regex(/[0-9]/, "סיסמה: חייבת לכלול ספרה"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "הסיסמאות אינן תואמות", path: ["confirm"] });

export type SetupState = { error?: string; values?: Record<string, string> } | undefined;

export async function runSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const raw = Object.fromEntries(
    ["token", "unitName", "unitCode", "fullName", "employeeNumber", "email", "phone", "password", "confirm"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );
  // ערכים להחזרה לטופס במקרה שגיאה – ללא סיסמאות וקוד
  const { token: _t, password: _p, confirm: _c, ...safeValues } = raw;
  void _t; void _p; void _c;
  const fail = (error: string): SetupState => ({ error, values: safeValues });

  if (!setupTokenConfigured()) return fail("ההקמה אינה זמינה (SETUP_TOKEN לא מוגדר).");

  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const failures = await db.auditLog.count({ where: { action: "SETUP_FAILED", createdAt: { gte: since } } });
  if (failures >= MAX_FAILURES) return fail(`יותר מדי ניסיונות כושלים. נסה שוב בעוד ${WINDOW_MIN} דקות.`);

  if (!setupTokenMatches(raw.token)) {
    await audit({ action: "SETUP_FAILED", entity: "Setup", details: "קוד הקמה שגוי" });
    return fail("קוד הקמה שגוי");
  }

  const parsed = SetupSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  const passwordHash = await bcrypt.hash(d.password, 12);

  let created: { userId: string; unitId: string };
  try {
    created = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;
      if ((await tx.user.count()) > 0) throw new Error("ALREADY_SETUP");
      const unit = await tx.unit.create({ data: { name: d.unitName, code: d.unitCode.toUpperCase() } });
      const user = await tx.user.create({
        data: {
          fullName: d.fullName,
          employeeNumber: d.employeeNumber,
          email: d.email,
          phone: d.phone,
          role: "ADMIN",
          unitId: unit.id,
          passwordHash,
        },
      });
      return { userId: user.id, unitId: unit.id };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_SETUP") redirect("/login");
    // P2002 = ערך ייחודי כפול (למשל שם/קוד יחידה שכבר קיימים)
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return fail("שם היחידה או קוד היחידה כבר קיימים במערכת");
    }
    throw e;
  }

  await audit({ userId: created.userId, action: "SETUP_COMPLETED", entity: "User", entityId: created.userId });
  await createSession({ userId: created.userId, role: "ADMIN", unitId: created.unitId });
  redirect("/admin");
}
