// Self-service password change. Requires the user's current password.
// On success clears the must-change flag and re-issues a fresh session.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, createSession } from "@/lib/auth";
import { getUser, changeOwnPassword } from "@/lib/repo/users";

const Body = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export async function POST(req: Request) {
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
    const updated = await changeOwnPassword(
      s.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    // Re-mint the cookie so the must-change banner clears immediately.
    await createSession({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      mustChangePassword: false,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
