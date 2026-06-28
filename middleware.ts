// Route guard: the entire back office is private. Pages bounce to /login;
// API routes return a JSON 401 (so the browser/fetch sees a real error rather
// than HTML). /uploads is public — files are served as static assets with
// unguessable random keys; sensitive docs go through a separate auth'd path.

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/uploads",
  "/sansi-logo.jpg", // brand logo shown on the public login page
  "/api/keepalive", // Supabase keep-alive cron — must reach the DB unauthenticated
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifyToken(token) : null;
  if (user) return NextResponse.next();

  // API: return 401 JSON, not an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  // Pages: bounce to /login.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, favicon, and the public auth APIs (login, forgot- and
  // reset-password) — those must be reachable while signed out.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/login|api/auth/forgot-password|api/auth/reset-password).*)",
  ],
};
