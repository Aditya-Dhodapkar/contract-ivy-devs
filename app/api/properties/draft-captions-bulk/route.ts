// POST /api/properties/draft-captions-bulk
//
// Fans the single-photo caption call out across an array of photos in
// parallel. Body: { photoUrls: string[], property? }.
// Returns: { captions: Array<{ photoUrl, caption?, error? }> }.
//
// A single photo failing does NOT fail the whole call — the response is
// per-photo so the UI can show "AI captioned 4 of 5; one failed, click
// to retry just that one."

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { draftCaption } from "@/lib/brochure/claude";
import { photoUrlToDataUrl } from "@/lib/brochure/photo-fetch";
import type { PropertyRecord } from "@/lib/repo/properties";

const MAX_PHOTOS_PER_CALL = 12;

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!can(user.role, "createProperty")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    photoUrls?: string[];
    property?: Partial<PropertyRecord>;
  };

  if (!Array.isArray(body.photoUrls) || body.photoUrls.length === 0) {
    return NextResponse.json(
      { error: "photoUrls (non-empty array) is required" },
      { status: 400 }
    );
  }
  if (body.photoUrls.length > MAX_PHOTOS_PER_CALL) {
    return NextResponse.json(
      { error: `Too many photos. Max ${MAX_PHOTOS_PER_CALL} per call.` },
      { status: 400 }
    );
  }

  const property = body.property ?? {};
  const total = body.photoUrls.length;

  // Fan-out in parallel. Each photo gets its own try/catch so one failure
  // doesn't drop the rest.
  const results = await Promise.all(
    body.photoUrls.map(async (photoUrl, i) => {
      try {
        const dataUrl = await photoUrlToDataUrl(photoUrl);
        const caption = await draftCaption(property, dataUrl, `${i + 1} of ${total}`);
        return { photoUrl, caption };
      } catch (e) {
        return {
          photoUrl,
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    })
  );

  return NextResponse.json({ captions: results });
}
