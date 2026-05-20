// #6 Create user (Owner only) + list (Owner only). All four roles are
// available; assignedRegions optional.

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isFail } from "@/lib/guard";
import { listUsers, createUser } from "@/lib/repo/users";

const Body = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["owner", "assistant", "general_manager", "agent"]),
  assignedRegions: z.array(z.string().trim().min(1)).optional(),
});

export async function GET() {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const users = await listUsers();
  // Never return password hashes to the client.
  const safe = users.map(({ passwordHash, ...u }) => u);
  return NextResponse.json({ users: safe });
}

export async function POST(req: Request) {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  try {
    const created = await createUser(parsed.data);
    const { passwordHash, ...safe } = created;
    return NextResponse.json({ user: safe }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
