// Deliverable #15 Dashboard. Role-aware: only shows what the signed-in role
// may access (proves the permission system end to end).

import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, MessageSquare, BarChart3, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { permissionsFor, ROLE_LABELS } from "@/lib/roles";
import { Header } from "@/components/Header";
import { countPendingApprovals } from "@/lib/repo/properties";

// Friendly display name from the email's local part — works whether or not
// the user record's `name` field is set, and avoids showing the raw email.
//   owner@test.com → "Owner"
//   jane.doe@…     → "Jane Doe"
function ApprovalsCallout({ count }: { count: number }) {
  if (count === 0) {
    return (
      <aside className="border border-hairline/15 bg-paper p-6 text-sm">
        <p className="text-eyebrow uppercase text-ash">Approval queue</p>
        <p className="mt-3 text-ink-mute">Nothing waiting for your review.</p>
      </aside>
    );
  }
  return (
    <aside className="border border-gold/40 bg-gold/5 p-6">
      <p className="text-eyebrow uppercase text-gold-deep">Awaiting your review</p>
      <p className="mt-3 font-serif text-5xl text-ink">{count}</p>
      <p className="mt-1 text-sm text-ink-mute">
        {count === 1 ? "property is" : "properties are"} pending your approval.
      </p>
      <Link
        href="/approvals"
        className="mt-6 inline-block bg-gold-deep px-4 py-2 text-eyebrow uppercase text-paper hover:bg-ink"
      >
        Open queue →
      </Link>
    </aside>
  );
}

function displayNameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const perms = permissionsFor(user.role);
  const name = displayNameFromEmail(user.email);
  // Only Owners approve, so only Owners get the queue tile.
  const pendingCount = user.role === "owner" ? await countPendingApprovals() : 0;

  const tiles = [
    { show: true, title: "Properties", desc: "Browse & manage listings", href: "/properties", Icon: Building2 },
    { show: perms.createProperty, title: "Add property", desc: "Create a new record", href: "/properties/new", Icon: Plus },
    { show: perms.viewInquiries !== false, title: "Inquiries", desc: "Leads & follow-ups", href: "/leads", Icon: MessageSquare },
    { show: perms.viewReports, title: "Reports", desc: "Weekly activity", href: "/reports", Icon: BarChart3 },
    { show: perms.manageUsers, title: "Team & roles", desc: "Members & permissions", href: "/team", Icon: Users },
  ].filter((t) => t.show);

  return (
    <div className="min-h-screen bg-ivory">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-eyebrow uppercase text-ash">{ROLE_LABELS[user.role]}</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Welcome, {name}</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Here is everything you have access to.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr,18rem]">
          <section className="divide-y divide-hairline/15 border-y border-hairline/15">
            {tiles.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="group flex items-center justify-between gap-6 bg-paper px-7 py-6 transition-colors hover:bg-ivory-deep"
              >
                <div className="flex items-center gap-5">
                  <t.Icon
                    className="h-6 w-6 shrink-0 text-gold-deep"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <div>
                    <h2 className="font-serif text-2xl text-ink">{t.title}</h2>
                    <p className="mt-0.5 text-sm text-ink-mute">{t.desc}</p>
                  </div>
                </div>
                <span className="text-eyebrow uppercase text-gold-deep opacity-60 transition-opacity group-hover:opacity-100">
                  Open →
                </span>
              </a>
            ))}
          </section>

          {user.role === "owner" && <ApprovalsCallout count={pendingCount} />}
        </div>
      </main>
    </div>
  );
}
