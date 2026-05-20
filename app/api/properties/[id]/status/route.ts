// #37–#41 status (Draft / Active / Sold / Rented). Scoped edit permission.
// Sold/Rented is what drives the website banner (#42) — surfaced on read.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty, updateProperty, type PropertyStatus } from "@/lib/repo/properties";

const VALID: PropertyStatus[] = ["draft", "active", "sold", "rented"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!can(user.role, "editProperty", { isOwnerOfRecord: prop.assignedAgentId === user.id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json().catch(() => ({}));
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateProperty(id, { status }, user.role);
  return NextResponse.json({
    property: updated,
    banner: status === "sold" || status === "rented" ? status.toUpperCase() : null,
  });
}
