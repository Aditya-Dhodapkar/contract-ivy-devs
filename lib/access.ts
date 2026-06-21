// Grant-aware access helpers. The role system in lib/roles.ts is the baseline;
// the Owner can additionally GRANT individual capabilities to a user from the
// Team page. Those grants are stored on the user record and applied on top of
// the role default.
//
// Grants take effect IMMEDIATELY (client decision): we read the acting user's
// grants fresh from the repo each request rather than baking them into the
// session token, so granting/revoking is instant and a revoke can't be
// out-run by a still-valid cookie.

import { getSession, type SessionUser } from "./auth";
import { getUser } from "./repo/users";
import { can, sanitizeGrants, type Capability, type Role } from "./roles";

export interface ActingUser extends SessionUser {
  grants: Capability[];
}

/** The signed-in user plus their current capability grants (fresh from the DB).
 *  Returns null when unauthenticated. */
export async function actingUser(): Promise<ActingUser | null> {
  const session = await getSession();
  if (!session) return null;
  const record = await getUser(session.id);
  return { ...session, grants: sanitizeGrants(record?.grants) };
}

/** can() for a resolved acting user — folds their grants into the check. */
export function canDo(
  user: { role: Role; grants?: readonly string[] },
  capability: Capability,
  ctx: { isOwnerOfRecord?: boolean } = {}
): boolean {
  return can(user.role, capability, { ...ctx, grants: user.grants });
}
