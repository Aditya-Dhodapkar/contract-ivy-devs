// #44–#46 private listing + access code. A private property is never public;
// it requires an access code (format pending client, needs.md #18). Same
// scoped permission as publishing.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty, updateProperty } from "@/lib/repo/properties";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!can(user.role, "publishToWebsite", { isOwnerOfRecord: prop.assignedAgentId === user.id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { isPrivate, accessCode } = await req.json().catch(() => ({}));

  if (isPrivate === true && !accessCode?.trim()) {
    return NextResponse.json(
      { error: "A private listing requires an access code." },
      { status: 400 }
    );
  }

  // Going private forces it off the public site.
  const patch =
    isPrivate === true
      ? { isPrivate: true, accessCode: accessCode.trim(), showOnWebsite: false }
      : { isPrivate: false, accessCode: undefined };

  const updated = await updateProperty(id, patch, user.role);
  return NextResponse.json({ property: updated });
}
