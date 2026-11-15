import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  encryptSession,
  decryptSession,
  type SessionPayload,
} from "./session-token";

export async function createSession(data: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const token = await encryptSession({ ...data, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function readSession() {
  return decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
