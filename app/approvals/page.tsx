// Focused approval queue. Owner-only. Lists every property currently in
// "pending" state, oldest first (so the longest-waiting submission rises to
// the top). Each row links into the existing property detail page where the
// Owner can review the full submission and Approve / Request changes.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProperties } from "@/lib/repo/properties";
import { listUsers } from "@/lib/repo/users";
import { Header } from "@/components/Header";
import { formatKes } from "@/lib/format";
import { relativeTime } from "@/lib/relative";

export default async function ApprovalsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/dashboard");

  const all = await listProperties({ role: user.role, userId: user.id });
  const pending = all
    .filter((p) => p.approval === "pending")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // Resolve agent names — one read, mapped by id.
  const users = await listUsers();
  const agentName = (id?: string) => users.find((u) => u.id === id)?.name ?? "—";

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/dashboard", label: "Home" }} />
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-serif text-3xl">Approval queue</h1>
        <p className="mt-1 text-sm text-ink-mute">
          Properties submitted by your assistants and agents that need your sign-off
          before they can be published to the website.
        </p>

        {pending.length === 0 ? (
          <div className="mt-12 border border-hairline/15 bg-paper px-6 py-10 text-center text-sm text-ink-mute">
            Nothing waiting for your review. ✓
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-hairline/15 border-y border-hairline/15">
            {pending.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  className="flex items-center justify-between gap-6 bg-paper px-5 py-5 hover:bg-ivory-deep"
                >
                  <div className="min-w-0">
                    <p className="font-serif text-xl text-ink">{p.title || "Untitled"}</p>
                    <p className="mt-0.5 text-xs text-ash">
                      {p.referenceNumber} ·{" "}
                      {[p.city, p.country].filter(Boolean).join(", ") || "—"} ·{" "}
                      {p.propertyType || "—"}
                    </p>
                    <p className="mt-1 text-xs text-ink-mute">
                      Submitted {relativeTime(p.createdAt)} by {agentName(p.assignedAgentId)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatKes(p.price)}</p>
                    <p className="mt-2 text-eyebrow uppercase text-gold-deep">Review →</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
