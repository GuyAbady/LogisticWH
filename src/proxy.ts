import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/lib/session-token";
import { ROLE_HOME, canAccessPath } from "@/lib/roles";

// בדיקה "אופטימית" בלבד (קריאת העוגייה, ללא DB). הבדיקה המחייבת נעשית ב-DAL.
// מקור: Next.js Authentication guide – "Optimistic checks with Proxy".
const PROTECTED = ["/employee", "/manager", "/warehouse"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await decryptSession(req.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isProtected && session && !canAccessPath(session.role, pathname)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.nextUrl));
  }
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icon.svg|manifest.webmanifest|favicon.ico).*)"],
};
