// #43 publish to website, gated by the pre-publish checklist (#52–#62).
// If incomplete, refuse and return exactly what's missing. publishToWebsite
// is scoped: Agents may toggle only their own; GM cannot at all.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty, updateProperty } from "@/lib/repo/properties";
import { hasMandateDoc } from "@/lib/repo/documents";
import { checklist } from "@/lib/prepublish";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!can(user.role, "publishToWebsite", { isOwnerOfRecord: prop.assignedAgentId === user.id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { show } = await req.json().catch(() => ({ show: true }));

  // Taking it OFF the website is always allowed.
  if (show === false) {
    const updated = await updateProperty(id, { showOnWebsite: false });
    return NextResponse.json({ property: updated });
  }

  // Going live: must pass the checklist.
  const result = checklist(prop, await hasMandateDoc(id));
  if (!result.ok) {
    return NextResponse.json(
      { error: "Cannot publish — incomplete", missing: result.missing },
      { status: 422 }
    );
  }
  const updated = await updateProperty(id, { showOnWebsite: true });
  return NextResponse.json({ property: updated });
}
