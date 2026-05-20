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
