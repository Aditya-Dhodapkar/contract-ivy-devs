// Shared auth + permission gate for property routes. Returns the session on
// success, or a Response (401/403) to return immediately. Built on the
// existing lib/roles.ts can() — single source of truth (#10).

import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { can, sanitizeGrants, type Capability, type Permissions } from "@/lib/roles";
import { getUser } from "@/lib/repo/users";

// The session user, augmented with the grants read fresh for this request.
export type GuardUser = SessionUser & { grants: Capability[] };
type GuardOk = { user: GuardUser };
type GuardFail = { response: NextResponse };

export async function guard(
  capability: keyof Permissions,
  ctx: { isOwnerOfRecord?: boolean } = {}
): Promise<GuardOk | GuardFail> {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  // Read grants fresh so changes (especially revokes) apply immediately.
  const record = await getUser(session.id);
  const grants = sanitizeGrants(record?.grants);
  if (!can(session.role, capability, { ...ctx, grants })) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user: { ...session, grants } };
}

export function isFail(r: GuardOk | GuardFail): r is GuardFail {
  return "response" in r;
}
