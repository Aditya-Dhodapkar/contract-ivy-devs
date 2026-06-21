// Owner-only password reset. Returns a one-time temp password the Owner
// shows to the user (over WhatsApp, in person, etc.). The user is flagged
// must-change so the UI prompts them on next sign-in.

import { NextResponse } from "next/server";
import { guard, isFail } from "@/lib/guard";
import { getUser, resetUserPassword } from "@/lib/repo/users";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const { id } = await params;
  const target = await getUser(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only a real Owner can reset an Owner's password — otherwise a granted
  // "manage team" user could reset the owner's password and take over.
  if (target.role === "owner" && g.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can reset the owner's password." },
      { status: 403 }
    );
  }

  try {
    const { tempPassword } = await resetUserPassword(id);
    return NextResponse.json({ tempPassword });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
