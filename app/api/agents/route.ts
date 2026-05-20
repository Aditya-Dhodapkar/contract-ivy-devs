// Light list of active agents for the PropertyForm "Assigned agent" dropdown
// (#35). Available to anyone who can create a property — not Owner-gated.

import { NextResponse } from "next/server";
import { guard, isFail } from "@/lib/guard";
import { listActiveAgents } from "@/lib/repo/users";

export async function GET() {
  const g = await guard("createProperty");
  if (isFail(g)) return g.response;
  const agents = await listActiveAgents();
  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      assignedRegions: a.assignedRegions ?? [],
    })),
  });
}
