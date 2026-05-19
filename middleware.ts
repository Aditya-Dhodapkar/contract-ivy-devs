// Route guard: the entire back office is private. Anyone without a valid
// session is bounced to /login. Deliverables #1, #5, and the brief's hard
// rule that visitors never see this area.

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Guard everything except Next internals and the login API.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/login).*)"],
};
