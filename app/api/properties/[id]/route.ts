// #19 view, #20/#41 edit, #47/#48 delete. Delete is hard-gated to the Owner
// (brief non-negotiable #1) — belt and braces beyond can().

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty, updateProperty, deleteProperty, type PropertyRecord } from "@/lib/repo/properties";
import { listActiveAgents } from "@/lib/repo/users";
import { UpdatePropertySchema } from "@/lib/validation/property";
import { validationError } from "@/lib/apiError";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Agents cannot open another agent's property (#51).
  if (user.role === "agent" && prop.assignedAgentId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ property: prop });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerOfRecord = prop.assignedAgentId === user.id;
  if (!can(user.role, "editProperty", { isOwnerOfRecord })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate shape + ranges. Every field is optional on update (a PATCH may
  // touch just one); referenceNumber/approval/id are stripped here by the
  // schema and again in updateProperty — parity kept. The non-owner→pending
  // reset still happens inside updateProperty (driven by user.role).
  const parsed = UpdatePropertySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);

  // L2: a non-agent reassigning must pick a real, active agent.
  if (user.role !== "agent" && parsed.data.assignedAgentId) {
    const agents = await listActiveAgents();
    if (!agents.some((a) => a.id === parsed.data.assignedAgentId)) {
      return NextResponse.json(
        {
          error: "That agent isn't available — pick an active agent.",
          fields: { assignedAgentId: "Choose an active agent." },
        },
        { status: 422 }
      );
    }
  }

  try {
    // Cast: see the note in app/api/properties/route.ts — schema-accepted null
    // photoDimensions entries are narrowed by the record type; parity behaviour.
    const updated = await updateProperty(id, parsed.data as Partial<PropertyRecord>, user.role);
    return NextResponse.json({ property: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Only the Owner. Not even via can() alone — explicit hard rule.
  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can delete a property." },
      { status: 403 }
    );
  }
  if (!(await getProperty(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteProperty(id);
  return NextResponse.json({ ok: true });
}
