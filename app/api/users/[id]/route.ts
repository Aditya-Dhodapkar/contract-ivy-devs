// #7 Edit user (Owner only). No DELETE — deactivation is at a separate route
// to enforce soft-deactivate as the only path (#8).

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isFail } from "@/lib/guard";
import { sanitizeGrants } from "@/lib/roles";
import { getUser, updateUser, deleteUser } from "@/lib/repo/users";
import { countPropertiesAssignedTo } from "@/lib/repo/properties";

// Admins cannot set someone else's password directly — they use the
// dedicated /reset-password endpoint, which generates a one-time temp pass.
const Body = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["owner", "assistant", "general_manager", "agent"]).optional(),
  assignedRegions: z.array(z.string().trim().min(1)).optional(),
  // Capability grants. Editing these is Owner-only (enforced in PATCH).
  grants: z.array(z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const { id } = await params;
  const u = await getUser(id);
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { passwordHash, ...safe } = u;
  return NextResponse.json({ user: safe });
}

export async function PATCH(req: Request, { params }: Params) {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const patch = { ...parsed.data };
  const target = await getUser(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A user merely GRANTED "manage team" can edit ordinary members, but must not
  // be able to escalate: no touching the Owner account, no assigning the owner
  // role, and no handing out permissions (those stay real-Owner-only).
  if (g.user.role !== "owner") {
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Only the owner can edit the owner account." },
        { status: 403 }
      );
    }
    if (patch.role === "owner") {
      return NextResponse.json(
        { error: "Only the owner can assign the owner role." },
        { status: 403 }
      );
    }
    if (patch.grants !== undefined) {
      return NextResponse.json(
        { error: "Only the owner can change permissions." },
        { status: 403 }
      );
    }
  }
  // Never grant-edit an Owner (they already have everything).
  if (patch.grants !== undefined && target.role === "owner") {
    return NextResponse.json(
      { error: "The owner already has every permission." },
      { status: 400 }
    );
  }
  if (patch.grants !== undefined) patch.grants = sanitizeGrants(patch.grants);
  try {
    const updated = await updateUser(id, patch);
    const { passwordHash, ...safe } = updated;
    return NextResponse.json({ user: safe });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

// Hard delete — Owner only. Blocks self-delete and blocks deletion of users
// who currently have properties assigned to them (would orphan the records).
// Deactivation remains the soft path that preserves history.
export async function DELETE(_req: Request, { params }: Params) {
  const g = await guard("manageUsers");
  if (isFail(g)) return g.response;
  const { id } = await params;
  if (g.user.id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }
  const target = await getUser(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only a real Owner can delete an Owner account.
  if (target.role === "owner" && g.user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can delete the owner account." },
      { status: 403 }
    );
  }

  const assigned = await countPropertiesAssignedTo(id);
  if (assigned > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${target.name} has ${assigned} ${assigned === 1 ? "property" : "properties"} assigned. Reassign them first, or deactivate the user instead.`,
      },
      { status: 409 }
    );
  }
  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
