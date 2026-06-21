// Weekly activity — a light snapshot of the portfolio. Metrics are computed
// live from the properties data (no separate analytics store yet), so figures
// are point-in-time except where a date is available (new this week uses
// createdAt). Gated by viewReports (Owner / Assistant / GM).

import { redirect } from "next/navigation";
import { Building2, Globe, Clock, Sparkles, Lock, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { permissionsFor } from "@/lib/roles";
import { Header } from "@/components/Header";
import { listProperties, countPendingApprovals } from "@/lib/repo/properties";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function StatCard({
  label,
  value,
  hint,
  Icon,
  accent = false,
}: {
  label: string;
  value: number;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={`border p-6 ${
        accent ? "border-gold/40 bg-gold/5" : "border-hairline/15 bg-paper"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-eyebrow uppercase text-ash">{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-gold-deep" : "text-ash"}`} />
      </div>
      <p className="mt-3 font-serif text-5xl text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!permissionsFor(user.role).viewReports) redirect("/dashboard");

  const [properties, pending] = await Promise.all([
    listProperties({ role: user.role, userId: user.id }),
    countPendingApprovals(),
  ]);

  const now = Date.now();
  const newThisWeek = properties.filter((p) => {
    const t = Date.parse(p.createdAt);
    return !Number.isNaN(t) && now - t <= WEEK_MS;
  }).length;

  const live = properties.filter((p) => p.showOnWebsite).length;
  const privateCount = properties.filter((p) => p.isPrivate).length;
  const byStatus = {
    draft: properties.filter((p) => p.status === "draft").length,
    active: properties.filter((p) => p.status === "active").length,
    sold: properties.filter((p) => p.status === "sold").length,
    rented: properties.filter((p) => p.status === "rented").length,
  };
  const total = properties.length;

  const statusRows: { label: string; value: number; color: string }[] = [
    { label: "Draft", value: byStatus.draft, color: "bg-ash" },
    { label: "Active", value: byStatus.active, color: "bg-green-600" },
    { label: "Sold", value: byStatus.sold, color: "bg-gold-deep" },
    { label: "Rented", value: byStatus.rented, color: "bg-ink" },
  ];
  const maxStatus = Math.max(1, ...statusRows.map((r) => r.value));

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/dashboard", label: "Dashboard" }} />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-eyebrow uppercase text-ash">This week</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Activity</h1>
        <p className="mt-1 text-sm text-ink-mute">
          A snapshot of the portfolio across the back office.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Pending approval"
            value={pending}
            hint={pending === 0 ? "Queue is clear" : "Waiting on the Owner"}
            Icon={Clock}
            accent={pending > 0}
          />
          <StatCard
            label="Live on website"
            value={live}
            hint="Currently public"
            Icon={Globe}
          />
          <StatCard
            label="New this week"
            value={newThisWeek}
            hint="Added in the last 7 days"
            Icon={Sparkles}
          />
          <StatCard
            label="Active listings"
            value={byStatus.active}
            hint="Status: active"
            Icon={CheckCircle2}
          />
          <StatCard
            label="Total properties"
            value={total}
            hint="All records"
            Icon={Building2}
          />
          <StatCard
            label="Private listings"
            value={privateCount}
            hint="Access-code only"
            Icon={Lock}
          />
        </div>

        <div className="mt-10 border border-hairline/15 bg-paper p-6">
          <p className="text-eyebrow uppercase text-ash">Portfolio by status</p>
          <div className="mt-5 space-y-4">
            {statusRows.map((r) => (
              <div key={r.label} className="flex items-center gap-4">
                <span className="w-16 text-sm text-ink-mute">{r.label}</span>
                <div className="h-2 flex-1 overflow-hidden bg-ivory-deep">
                  <div
                    className={`h-full ${r.color}`}
                    style={{ width: `${(r.value / maxStatus) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-serif text-lg text-ink">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-xs text-ash">
          Figures are a live snapshot. Richer week-over-week trends will arrive
          as activity history is captured.
        </p>
      </div>
    </div>
  );
}
