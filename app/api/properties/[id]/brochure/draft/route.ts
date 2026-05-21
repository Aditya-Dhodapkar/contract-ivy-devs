// Step 1 of the brochure flow: Claude drafts the editorial slots. Returns
// JSON the preview page hydrates the form with. No PDF is generated yet —
// the human edits/approves before the next step.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { draftBrochureCopy } from "@/lib/brochure/claude";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user.role, "generateBrochure")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Agents are not allowed to see another agent's record at all — but the
  // permission above already excludes Agents from this route entirely.
  try {
    const slots = await draftBrochureCopy(p);
    return NextResponse.json({ slots });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
