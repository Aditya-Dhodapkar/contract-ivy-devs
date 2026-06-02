// POST /api/properties/draft-description
//
// Owner-facing endpoint behind the PropertyForm "✨ Let AI draft this"
// button next to the description textarea. Takes the current form values
// (whatever the owner has filled in so far) and returns 80-120 words of
// SANSI-voice prose.
//
// Auth: the same role gate as brochure generation — only roles allowed
// to author listings can spend AI tokens.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { draftDescription } from "@/lib/brochure/claude";
import type { PropertyRecord } from "@/lib/repo/properties";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  // Reuse the create-property permission — anyone who can create can
  // author description copy; no separate "AI draft" gate.
  if (!can(user.role, "createProperty")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<PropertyRecord>;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const description = await draftDescription(body);
    if (!description) {
      return NextResponse.json(
        { error: "Empty description returned. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ description });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
