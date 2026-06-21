// #18 create, #21 list (role-scoped #51). GM is read-only: can list, cannot
// create. Agents see/create only their own.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { guard, isFail } from "@/lib/guard";
import { listProperties, createProperty, type PropertyRecord } from "@/lib/repo/properties";
import { listAssignableUsers } from "@/lib/repo/users";
import { CreatePropertySchema } from "@/lib/validation/property";
import { validationError } from "@/lib/apiError";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const rows = await listProperties({ role: user.role, userId: user.id });
  return NextResponse.json({ properties: rows });
}

export async function POST(req: Request) {
  const g = await guard("createProperty");
  if (isFail(g)) return g.response;

  // Validate shape + ranges first. Malformed JSON → null → a clean 422, not a
  // crash. Empty/garbage bodies are rejected here, never reaching the repo (C2).
  const parsed = CreatePropertySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  // Agents can only create properties assigned to themselves.
  const assignedAgentId =
    g.user.role === "agent" ? g.user.id : parsed.data.assignedAgentId;

  // Assignment is OPTIONAL — a non-agent may leave it unassigned and assign
  // later. But if they DID pick someone, it must be a real, active, assignable
  // user (owner / assistant / agent).
  if (g.user.role !== "agent" && assignedAgentId) {
    const assignable = await listAssignableUsers();
    if (!assignable.some((a) => a.id === assignedAgentId)) {
      return NextResponse.json(
        {
          error: "That person isn't available — pick an active team member.",
          fields: { assignedAgentId: "Choose an active team member." },
        },
        { status: 422 }
      );
    }
  }

  try {
    // Cast: the schema accepts `null` photoDimensions entries (unknown dims,
    // positionally indexed alongside photos) which the record type narrows to
    // {w,h}; nulls already flowed through the prior untyped path, so this is
    // parity, not new behaviour.
    const created = await createProperty(
      { ...parsed.data, assignedAgentId } as Partial<PropertyRecord>,
      g.user.role
    );
    return NextResponse.json({ property: created }, { status: 201 });
  } catch (e) {
    // Surface the real reason (e.g. "Could not allocate a unique reference
    // number…", FS/DB failure) instead of a generic line (H1).
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
