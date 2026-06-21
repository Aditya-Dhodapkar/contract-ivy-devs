// Light list of assignable users for the PropertyForm "Assigned to" dropdown.
// Includes owner + assistant + agents (not just agents) so a listing can be
// assigned to whoever's responsible. Available to anyone who can create a
// property — not Owner-gated.

import { NextResponse } from "next/server";
import { guard, isFail } from "@/lib/guard";
import { listAssignableUsers } from "@/lib/repo/users";

export async function GET() {
  const g = await guard("createProperty");
  if (isFail(g)) return g.response;
  const users = await listAssignableUsers();
  return NextResponse.json({
    agents: users.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      assignedRegions: a.assignedRegions ?? [],
    })),
  });
}
