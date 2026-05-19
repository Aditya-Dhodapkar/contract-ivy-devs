// Deliverable #1 Login. Verifies email + bcrypt password against the Sanity
// `user` records, then mints a session cookie.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sanity } from "@/lib/sanity";
import { createSession } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { usingDevUsers, findDevUser } from "@/lib/devUsers";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Dev fallback: test all roles before the client's Sanity exists.
  const user = usingDevUsers
    ? findDevUser(email)
    : await sanity.fetch(
        `*[_type == "user" && email == $email && active == true][0]{
          "id": _id, name, email, role, passwordHash
        }`,
        { email }
      );

  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
  });
  return NextResponse.json({ ok: true });
}
