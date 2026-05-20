// Owner-only: ask for changes with an explanatory note. The note is shown
// to the assistant/agent on the property detail until they re-submit (their
// next edit clears it and flips state back to "pending").

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProperty, setApproval } from "@/lib/repo/properties";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Owner can request changes." },
      { status: 403 }
    );
  }
  const { id } = await params;
  if (!(await getProperty(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { note } = await req.json().catch(() => ({ note: "" }));
  if (!note || typeof note !== "string" || !note.trim()) {
    return NextResponse.json(
      { error: "A note is required so the agent knows what to change." },
      { status: 400 }
    );
  }
  const updated = await setApproval(id, "changes_requested", note.trim());
  return NextResponse.json({ property: updated });
}
