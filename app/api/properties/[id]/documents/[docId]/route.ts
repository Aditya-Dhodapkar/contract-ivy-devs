// Delete a single document. Owner-only — server-enforced via the
// deleteDocument capability (which is `true` for Owner, `false` for
// everyone else). Belt + braces: we also check user.role === "owner"
// explicitly, same pattern as property delete.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { deleteDocument, getDocumentRecord } from "@/lib/repo/documents";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id, docId } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Belt + braces: the capability check below would already reject non-owners,
  // but mirroring the property-delete pattern keeps the rule explicit.
  if (user.role !== "owner" || !can(user.role, "deleteDocument")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Make sure the doc actually belongs to this property — defence against
  // a crafted URL where someone substitutes another property's docId.
  const doc = await getDocumentRecord(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.propertyId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sanity-check the property still exists (cascade should keep them aligned
  // but the dev backend doesn't enforce FKs).
  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteDocument(docId, { id: user.id, email: user.email, name: user.name });
  return NextResponse.json({ ok: true });
}
