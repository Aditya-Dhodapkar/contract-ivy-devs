// Documents for a property — list + upload.
// Sensitive: the GET only returns metadata (filenames, timestamps, access
// log). The raw bytes never come through this route — see the dedicated
// /download endpoint for that, which is the only place bytes leave the
// server and the only place access is logged.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import {
  DOC_TYPES,
  type DocType,
  listForProperty,
  uploadDocument,
} from "@/lib/repo/documents";
import { isAllowedDocument, DOCUMENT_MAX_BYTES } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerOfRecord = prop.assignedAgentId === user.id;
  if (!can(user.role, "viewDocuments", { isOwnerOfRecord })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await listForProperty(id);
  return NextResponse.json({ documents });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerOfRecord = prop.assignedAgentId === user.id;
  if (!can(user.role, "uploadDocument", { isOwnerOfRecord })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Reject oversize early via Content-Length, before formData() parses.
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (>${DOCUMENT_MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const docTypeRaw = form.get("docType");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof docTypeRaw !== "string" || !DOC_TYPES.includes(docTypeRaw as DocType)) {
    return NextResponse.json(
      { error: `docType must be one of: ${DOC_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (>${DOCUMENT_MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 }
    );
  }
  if (!isAllowedDocument(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and image files (jpg, png, webp, heic) are allowed." },
      { status: 415 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const doc = await uploadDocument({
    propertyId: id,
    docType: docTypeRaw as DocType,
    buf,
    mime: file.type,
    fileName: file.name || `${docTypeRaw}.bin`,
    uploader: { id: user.id, email: user.email, name: user.name },
  });
  return NextResponse.json({ document: doc }, { status: 201 });
}
