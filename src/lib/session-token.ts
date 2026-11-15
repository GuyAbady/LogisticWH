// הצפנה/פענוח של טוקן ה-Session. ללא 'server-only' כדי שיהיה זמין גם ל-proxy.ts.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "lwh_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 שעות – משמרת עבודה

export type SessionPayload = {
  userId: string;
  role: Role;
  unitId: string;
  expiresAt: number;
};

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET חייב להיות מוגדר ובאורך 32 תווים לפחות");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(key());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
