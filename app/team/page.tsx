// Team list — Owner only. Grouped by tier so the hierarchy is obvious at a
// glance: Owner up top (prominent), then Management, then Agents.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { permissionsFor, ROLE_LABELS, type Role } from "@/lib/roles";
import { listUsers, type UserRecord } from "@/lib/repo/users";
import { relativeTime } from "@/lib/relative";
import { Header } from "@/components/Header";

export default async function TeamPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!permissionsFor(user.role).manageUsers) redirect("/dashboard");

  const users = await listUsers();
  const owners = users.filter((u) => u.role === "owner");
  const management = users.filter(
    (u) => u.role === "general_manager" || u.role === "assistant"
  );
  const agents = users.filter((u) => u.role === "agent");

  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl">Team & roles</h1>
          <Link
            href="/team/new"
            className="bg-ink px-4 py-2 text-eyebrow uppercase text-paper hover:bg-gold-deep"
          >
            Invite member
          </Link>
        </div>

        <div className="mt-10 space-y-10">
          <Section label="Owner" rows={owners} prominent />
          <Section label="Management" rows={management} />
          <Section label="Agents" rows={agents} />
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  rows,
  prominent = false,
}: {
  label: string;
  rows: UserRecord[];
  prominent?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <section>
        <SectionHeader label={label} count={0} />
        <p className="mt-4 text-sm text-ash">None yet.</p>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader label={label} count={rows.length} />
      <div className="mt-4 divide-y divide-hairline/15 border-y border-hairline/15">
        {rows.map((u) => <Row key={u.id} u={u} prominent={prominent} />)}
      </div>
    </section>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-hairline/20 pb-2">
      <p className="text-eyebrow uppercase text-ink">{label}</p>
      <span className="text-xs text-ash">{count}</span>
    </div>
  );
}

function Row({ u, prominent }: { u: UserRecord; prominent: boolean }) {
  return (
    <Link
      href={`/team/${u.id}`}
      className="flex items-center justify-between gap-4 bg-paper px-5 py-5 hover:bg-ivory-deep"
    >
      <div>
        <p className={prominent ? "font-serif text-2xl" : "font-serif text-xl"}>
          {u.name}
          {!u.active && <span className="ml-2 text-xs text-ash">(deactivated)</span>}
        </p>
        <p className="mt-0.5 text-xs text-ash">
          {u.email} · {ROLE_LABELS[u.role as Role]}
          {u.role === "agent" && u.assignedRegions?.length
            ? ` · ${u.assignedRegions.join(", ")}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-ink-mute">
          Last sign-in: {relativeTime(u.lastLoginAt)}
        </p>
      </div>
      <span className="text-eyebrow uppercase text-ink-mute">Edit →</span>
    </Link>
  );
}
