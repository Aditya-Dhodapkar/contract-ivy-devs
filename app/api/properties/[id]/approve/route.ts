// Owner-only: mark a property as approved → it becomes eligible for publish.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProperty, setApproval } from "@/lib/repo/properties";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the Owner can approve properties." },
      { status: 403 }
    );
  }
  const { id } = await params;
  if (!(await getProperty(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await setApproval(id, "approved");
  return NextResponse.json({ property: updated });
}
