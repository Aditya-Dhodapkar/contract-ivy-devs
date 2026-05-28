// THE single chokepoint for sensitive-document bytes leaving the server.
// Every request through here:
//   1. Auth-gates (must be logged in, must have viewDocuments for this prop)
//   2. Logs the access (view vs download) to the document's access_log
//   3. Streams the bytes back with Content-Type + Content-Disposition
//
// ?as=download forces a save dialog; otherwise the file opens inline
// (browser PDF viewer, image preview). Both flavours log separately so
// the access pattern is legible.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { logAccess, readDocumentBytes } from "@/lib/repo/documents";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id, docId } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerOfRecord = prop.assignedAgentId === user.id;
  if (!can(user.role, "viewDocuments", { isOwnerOfRecord })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await readDocumentBytes(docId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { record, bytes } = result;
  if (record.propertyId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("as") === "download";

  // Log first, stream second — even if the stream is cancelled mid-flight,
  // the access intent is recorded.
  await logAccess(docId, isDownload ? "download" : "view", {
    id: user.id,
    email: user.email,
    name: user.name,
  });

  // RFC 5987 encoded filename so non-ASCII characters survive HTTP headers.
  const safeName = encodeURIComponent(record.fileName);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": record.mimeType,
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename*=UTF-8''${safeName}`,
      "Content-Length": String(bytes.length),
      // These are personal/legal documents — never let an intermediate cache
      // store them.
      "Cache-Control": "private, no-store",
    },
  });
}
