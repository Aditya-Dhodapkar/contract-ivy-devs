// #8 Soft deactivate / reactivate. Owner only. Self-deactivation blocked so
// the owner cannot accidentally lock themselves out.

import { NextResponse } from "next/server";
import { guard, isFail } from "@/lib/guard";
import { getUser, setUserActive } from "@/lib/repo/users";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const { id } = await params;
  const target = await getUser(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only a real Owner can deactivate an Owner account — a granted "manage team"
  // user must not be able to lock out the owner.
  if (target.role === "owner" && g.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can deactivate the owner account." },
      { status: 403 }
    );
  }

  const { active } = await req.json().catch(() => ({ active: false }));

  // Block self-deactivation — no lockout via the UI.
  if (active === false && g.user.id === id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account." },
      { status: 400 }
    );
  }

  try {
    const updated = await setUserActive(id, active === true);
    const { passwordHash, ...safe } = updated;
    return NextResponse.json({ user: safe });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
