// Deliverable #1 Login. Looks up the user via the repo (which in dev combines
// the seed dev users + any users created in /team, and in production queries
// Sanity). Bcrypt-checks the password, blocks inactive accounts, then mints a
// session cookie.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { findUserByEmail, recordLogin } from "@/lib/repo/users";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rateLimit";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

/** Client IP from Vercel's forwarding headers; falls back to a constant so a
 *  missing header degrades to a shared bucket rather than disabling the limit. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 900) } }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordFailure(ip);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (!user.active) {
    return NextResponse.json(
      { error: "This account has been deactivated. Contact the owner." },
      { status: 403 }
    );
  }

  // Correct credentials for an active account — clear this IP's failure record.
  recordSuccess(ip);

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
  await recordLogin(user.id);
  return NextResponse.json({ ok: true, mustChangePassword: !!user.mustChangePassword });
}
