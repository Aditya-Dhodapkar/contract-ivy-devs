// #7 Edit user · #8 Deactivate user · #9 Assign role — Owner only.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { actingUser, canDo } from "@/lib/access";
import { sanitizeGrants } from "@/lib/roles";
import { getUser } from "@/lib/repo/users";
import { Header } from "@/components/Header";
import { UserForm } from "@/components/UserForm";
import { DeactivateButton } from "@/components/DeactivateButton";
import { ResetPasswordButton } from "@/components/ResetPasswordButton";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { relativeTime } from "@/lib/relative";

export default async function TeamMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  const me = await actingUser();
  if (!me) redirect("/login");
  if (!canDo(me, "manageUsers")) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  const u = await getUser(id);
  if (!u) notFound();

  const isSelf = me.id === u.id;
  // Granting capabilities is Owner-only — even an assistant who's been granted
  // "manage team" can edit users but cannot hand out permissions (no self- or
  // peer-escalation). The Owner's own row isn't editable here (always full).
  const canEditPermissions = me.role === "owner" && u.role !== "owner";

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/team", label: "Team" }} />
      <div className="mx-auto max-w-4xl px-6 py-12">
        {(sp.saved || sp.created) && (
          <div className="mb-6 flex items-center justify-between border border-gold/40 bg-gold/10 px-4 py-3">
            <span className="text-sm font-medium text-gold-deep">
              {sp.created ? "✓ Team member created." : "✓ Changes saved."}
            </span>
            <Link
              href="/team"
              className="text-eyebrow uppercase text-ink-mute hover:text-gold-deep"
            >
              ← Back to Team
            </Link>
          </div>
        )}

        <h1 className="font-serif text-3xl">{u.name}</h1>
        <p className="mt-1 text-sm text-ink-mute">
          {u.email}{!u.active && " · deactivated"}
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-[1fr,16rem]">
          <UserForm
            existing={{
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              assignedRegions: u.assignedRegions,
              active: u.active,
              seed: u.seed,
              grants: sanitizeGrants(u.grants),
            }}
            canEditPermissions={canEditPermissions}
          />

          <aside className="space-y-8 border border-hairline/15 bg-paper p-6">
            <div>
              <p className="text-eyebrow uppercase text-ash">Status</p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    u.active ? "bg-green-600" : "bg-ash"
                  }`}
                />
                {u.active ? "Active" : "Deactivated"}
              </div>
            </div>

            <div>
              <p className="text-eyebrow uppercase text-ash">Last sign-in</p>
              <p className="mt-3 text-sm">{relativeTime(u.lastLoginAt)}</p>
            </div>

            <div className="border-t border-hairline/15 pt-6">
              {isSelf ? (
                <p className="text-xs text-ash">
                  You can't deactivate or reset your own account here — use{" "}
                  <a href="/profile" className="underline hover:text-gold-deep">your profile</a>.
                </p>
              ) : (
                <div className="space-y-4">
                  <DeactivateButton id={u.id} active={u.active} />
                  <ResetPasswordButton userId={u.id} userName={u.name} />
                  {!u.seed && (
                    <DeleteUserButton userId={u.id} userName={u.name} />
                  )}
                  {u.seed && (
                    <p className="text-xs text-ash">
                      Seed users can't be deleted (defined in code) — deactivate instead.
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
