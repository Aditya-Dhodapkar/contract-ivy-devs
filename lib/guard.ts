// Shared auth + permission gate for property routes. Returns the session on
// success, or a Response (401/403) to return immediately. Built on the
// existing lib/roles.ts can() — single source of truth (#10).

import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { can, type Permissions } from "@/lib/roles";

type GuardOk = { user: SessionUser };
type GuardFail = { response: NextResponse };

export async function guard(
  capability: keyof Permissions,
  ctx: { isOwnerOfRecord?: boolean } = {}
): Promise<GuardOk | GuardFail> {
  const user = await getSession();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  if (!can(user.role, capability, ctx)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export function isFail(r: GuardOk | GuardFail): r is GuardFail {
  return "response" in r;
}
