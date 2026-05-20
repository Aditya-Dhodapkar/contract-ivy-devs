// #18 create, #21 list (role-scoped #51). GM is read-only: can list, cannot
// create. Agents see/create only their own.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { guard, isFail } from "@/lib/guard";
import { listProperties, createProperty } from "@/lib/repo/properties";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const rows = await listProperties({ role: user.role, userId: user.id });
  return NextResponse.json({ properties: rows });
}

export async function POST(req: Request) {
  const g = await guard("createProperty");
  if (isFail(g)) return g.response;

  const body = await req.json().catch(() => ({}));
  // Agents can only create properties assigned to themselves.
  const assignedAgentId =
    g.user.role === "agent" ? g.user.id : body.assignedAgentId;

  const created = await createProperty({ ...body, assignedAgentId }, g.user.role);
  return NextResponse.json({ property: created }, { status: 201 });
}
