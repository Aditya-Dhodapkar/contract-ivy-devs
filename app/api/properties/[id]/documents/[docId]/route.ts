// Delete a single document. Owner-only by default, but the Owner can GRANT
// document deletion to others (lib/roles GRANTABLE); the deleteDocument
// capability via guard() honours those grants.

import { NextResponse } from "next/server";
import { guard, isFail } from "@/lib/guard";
import { getProperty } from "@/lib/repo/properties";
import { deleteDocument, getDocumentRecord } from "@/lib/repo/documents";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id, docId } = await params;
  const g = await guard("deleteDocument");
  if (isFail(g)) return g.response;
  const user = g.user;

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
