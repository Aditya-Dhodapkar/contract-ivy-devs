// Deliverable #15 Dashboard. Role-aware: only shows what the signed-in role
// may access (proves the permission system end to end).

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { permissionsFor, ROLE_LABELS } from "@/lib/roles";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const perms = permissionsFor(user.role);

  const tiles = [
    { show: true, title: "Properties", desc: "Browse & manage listings", href: "/properties" },
    { show: perms.createProperty, title: "Add property", desc: "Create a new record", href: "/properties/new" },
    { show: perms.viewInquiries !== false, title: "Inquiries", desc: "Leads & follow-ups", href: "/leads" },
    { show: perms.viewReports, title: "Reports", desc: "Weekly activity", href: "/reports" },
    { show: perms.manageUsers, title: "Team & roles", desc: "Members & permissions", href: "/team" },
  ].filter((t) => t.show);

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-hairline/15 bg-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <p className="text-eyebrow uppercase text-ash">Sansi Africa — Back Office</p>
          <form action="/api/auth/logout" method="post">
            <button className="text-eyebrow uppercase text-ink-mute transition-colors hover:text-gold-deep">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-eyebrow uppercase text-ash">{ROLE_LABELS[user.role]}</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">{user.name}</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Here is everything you have access to.
        </p>

        <section className="mt-12 grid gap-px border border-hairline/15 bg-hairline/15 sm:grid-cols-2">
          {tiles.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="group bg-paper p-7 transition-colors hover:bg-ivory-deep"
            >
              <h2 className="font-serif text-2xl text-ink">{t.title}</h2>
              <p className="mt-1 text-sm text-ink-mute">{t.desc}</p>
              <span className="mt-5 inline-block text-eyebrow uppercase text-gold-deep opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </span>
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}
