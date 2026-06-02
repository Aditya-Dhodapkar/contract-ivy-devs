// POST /api/properties/draft-caption
//
// Single-photo caption endpoint. Body: { photoUrl, property?, positionHint? }.
// Returns: { caption } — 2-4 word editorial tag. The owner clicks the
// per-photo "✨" button next to a blank caption field; this is what runs.
//
// Bulk callers fan out N parallel single calls instead of a true bulk
// endpoint — keeps each prompt tight, makes retries trivial, lets
// individual failures degrade gracefully without losing the rest.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { draftCaption } from "@/lib/brochure/claude";
import { photoUrlToDataUrl } from "@/lib/brochure/photo-fetch";
import type { PropertyRecord } from "@/lib/repo/properties";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!can(user.role, "createProperty")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    photoUrl?: string;
    property?: Partial<PropertyRecord>;
    positionHint?: string;
  };

  if (!body.photoUrl || typeof body.photoUrl !== "string") {
    return NextResponse.json({ error: "photoUrl is required" }, { status: 400 });
  }

  try {
    const dataUrl = await photoUrlToDataUrl(body.photoUrl);
    const caption = await draftCaption(
      body.property ?? {},
      dataUrl,
      body.positionHint
    );
    if (!caption) {
      return NextResponse.json(
        { error: "Empty caption returned. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ caption });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
