// #19 view, #20/#41 edit, #47/#48 delete. Delete is hard-gated to the Owner
// (brief non-negotiable #1) — belt and braces beyond can().

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty, updateProperty, deleteProperty } from "@/lib/repo/properties";

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

  const patch = await req.json().catch(() => ({}));
  const updated = await updateProperty(id, patch);
  return NextResponse.json({ property: updated });
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
