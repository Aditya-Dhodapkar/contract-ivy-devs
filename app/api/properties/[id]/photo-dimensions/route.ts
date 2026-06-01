// Backfill endpoint for photo dimensions on older properties (uploaded
// before the dimension-capture feature shipped). The brochure-layout editor
// detects dimensions in the browser via Image().naturalWidth and POSTs them
// here. We merge them into p.photoDimensions, only writing to slots that
// are currently missing — never overwriting existing values.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty, updateProperty } from "@/lib/repo/properties";

type DimIn = { url: string; w: number; h: number };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const prop = await getProperty(id);
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnerOfRecord = prop.assignedAgentId === user.id;
  if (!can(user.role, "editProperty", { isOwnerOfRecord })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { dimensions?: DimIn[] };
  const incoming = Array.isArray(body.dimensions) ? body.dimensions : [];
  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const photos = prop.photos ?? [];
  const dims = [...(prop.photoDimensions ?? new Array(photos.length).fill(null))];
  let updated = 0;
  for (const d of incoming) {
    if (!d || typeof d.url !== "string" || !d.w || !d.h) continue;
    const idx = photos.indexOf(d.url);
    if (idx < 0) continue;
    // Only fill in missing entries — never overwrite a server-captured value.
    if (!dims[idx] || !dims[idx].w || !dims[idx].h) {
      dims[idx] = { w: d.w, h: d.h };
      updated++;
    }
  }
  if (updated === 0) return NextResponse.json({ ok: true, updated: 0 });

  await updateProperty(id, { photoDimensions: dims }, user.role);
  return NextResponse.json({ ok: true, updated });
}
