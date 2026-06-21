// #43 publish to website, gated by the pre-publish checklist (#52–#62).
// If incomplete, refuse and return exactly what's missing. publishToWebsite
// is scoped: Agents may toggle only their own; GM cannot at all.

import { NextResponse } from "next/server";
import { actingUser, canDo } from "@/lib/access";
import { getProperty, updateProperty } from "@/lib/repo/properties";
import { hasMandateDoc } from "@/lib/repo/documents";
import { checklist } from "@/lib/prepublish";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await actingUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canDo(user, "publishToWebsite", { isOwnerOfRecord: prop.assignedAgentId === user.id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { show } = await req.json().catch(() => ({ show: true }));

  // Taking it OFF the website is always allowed.
  if (show === false) {
    const updated = await updateProperty(id, { showOnWebsite: false }, user.role);
    return NextResponse.json({ property: updated });
  }

  // Going live: must be Owner-approved AND pass the pre-publish checklist.
  if (prop.approval !== "approved") {
    return NextResponse.json(
      {
        error:
          prop.approval === "changes_requested"
            ? "Cannot publish — the Owner requested changes."
            : "Cannot publish — pending Owner approval.",
        approval: prop.approval,
      },
      { status: 422 }
    );
  }
  const result = checklist(prop, await hasMandateDoc(id));
  if (!result.ok) {
    return NextResponse.json(
      { error: "Cannot publish — incomplete", missing: result.missing },
      { status: 422 }
    );
  }
  const updated = await updateProperty(id, { showOnWebsite: true }, user.role);
  return NextResponse.json({ property: updated });
}
