// Self-service profile: any signed-in user can read and edit their own name
// and email. Email change is allowed but must remain unique.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getUser, updateUser } from "@/lib/repo/users";

const Body = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const u = await getUser(s.id);
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { passwordHash, ...safe } = u;
  return NextResponse.json({ user: safe });
}

export async function PATCH(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  try {
    const updated = await updateUser(s.id, parsed.data);
    const { passwordHash, ...safe } = updated;
    return NextResponse.json({ user: safe });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
