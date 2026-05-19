// #21 list (role-scoped #51), #50 filter by region/status/type. Server
// component — listProperties already scopes Agents to their own.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { permissionsFor } from "@/lib/roles";
import { listProperties } from "@/lib/repo/properties";
import { StatusBadge } from "@/components/StatusBadge";
import { Header } from "@/components/Header";
import { formatUsd } from "@/lib/format";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; status?: string; type?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const sp = await searchParams;

  let rows = await listProperties({ role: user.role, userId: user.id });
  if (sp.city) rows = rows.filter((p) => p.city === sp.city);
  if (sp.status) rows = rows.filter((p) => p.status === sp.status);
  if (sp.type) rows = rows.filter((p) => p.propertyType === sp.type);

  const canCreate = permissionsFor(user.role).createProperty;

  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Properties</h1>
        {canCreate && (
          <Link
            href="/properties/new"
            className="bg-ink px-4 py-2 text-eyebrow uppercase text-paper hover:bg-gold-deep"
          >
            Add property
          </Link>
        )}
      </div>

      <form className="mt-8 flex flex-wrap gap-3 text-sm">
        <input name="city" defaultValue={sp.city} placeholder="City"
          className="border border-hairline/20 bg-ivory px-3 py-1.5" />
        <select name="status" defaultValue={sp.status ?? ""}
          className="border border-hairline/20 bg-ivory px-3 py-1.5">
          <option value="">Any status</option>
          {["draft", "active", "sold", "rented"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""}
          className="border border-hairline/20 bg-ivory px-3 py-1.5">
          <option value="">Any type</option>
          {["house", "apartment", "land", "commercial"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="border border-hairline/30 px-3 py-1.5 text-eyebrow uppercase">
          Filter
        </button>
      </form>

      <div className="mt-8 divide-y divide-hairline/15 border-y border-hairline/15">
        {rows.length === 0 && (
          <p className="py-8 text-sm text-ink-mute">No properties yet.</p>
        )}
        {rows.map((p) => (
          <Link
            key={p.id}
            href={`/properties/${p.id}`}
            className="flex items-center justify-between gap-4 py-4 hover:bg-paper"
          >
            <div>
              <p className="font-serif text-xl">{p.title || "Untitled"}</p>
              <p className="text-xs text-ash">
                {p.referenceNumber} · {[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.propertyType || "—"}
              </p>
              {p.price != null && (
                <p className="mt-0.5 text-sm text-ink-mute">{formatUsd(p.price)}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {p.isPrivate && (
                <span className="text-eyebrow uppercase text-ash">Private</span>
              )}
              <StatusBadge status={p.status} />
            </div>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}
