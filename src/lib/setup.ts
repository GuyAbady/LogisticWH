import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db";

export const MIN_SETUP_TOKEN_LEN = 16;

export function setupTokenConfigured() {
  return (process.env.SETUP_TOKEN?.length ?? 0) >= MIN_SETUP_TOKEN_LEN;
}

/** ההקמה פתוחה רק כש-SETUP_TOKEN מוגדר ואין אף משתמש במערכת */
export async function isSetupOpen() {
  if (!setupTokenConfigured()) return false;
  return (await db.user.count()) === 0;
}

/** השוואת קוד בזמן קבוע (Hash באורך קבוע, כי timingSafeEqual דורש אורכים זהים) */
export function setupTokenMatches(input: string) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(process.env.SETUP_TOKEN ?? "").digest();
  return timingSafeEqual(a, b);
}
