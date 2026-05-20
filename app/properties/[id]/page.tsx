// #19 detail + #20 edit + status/visibility/delete controls. Agents cannot
// open another agent's property (#51). GM sees but the form/controls reject
// writes server-side.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { PropertyForm } from "@/components/PropertyForm";
import { PropertyControls } from "@/components/PropertyControls";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalBadge } from "@/components/ApprovalBadge";
import { WebsiteBadge } from "@/components/WebsiteBadge";
import { Header } from "@/components/Header";
import { formatKes } from "@/lib/format";

export default async function PropertyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login");

  const p = await getProperty(id);
  if (!p) notFound();
  if (user.role === "agent" && p.assignedAgentId !== user.id) redirect("/properties");

  const isOwnerOfRecord = p.assignedAgentId === user.id;
  const canEdit = can(user.role, "editProperty", { isOwnerOfRecord });

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/properties", label: "Properties" }} />
      <div className="mx-auto max-w-4xl px-6 py-12">
      {(sp.saved || sp.created) && (
        <div className="mb-6 flex items-center justify-between border border-gold/40 bg-gold/10 px-4 py-3">
          <div className="text-sm">
            <span className="font-medium text-gold-deep">
              {sp.created ? "✓ Property created." : "✓ Changes saved."}
            </span>
          </div>
          <div className="flex items-center gap-4 text-eyebrow uppercase">
            <Link href="/properties" className="text-ink-mute hover:text-gold-deep">
              ← Back to Properties
            </Link>
            <Link href={`/properties/${id}`} className="text-ash hover:text-gold-deep">
              Dismiss
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">{p.title || "Untitled"}</h1>
          <p className="text-xs text-ash">
            {p.referenceNumber} · {[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.propertyType || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ApprovalBadge approval={p.approval} />
          <StatusBadge status={p.status} />
          <WebsiteBadge live={p.showOnWebsite} />
        </div>
      </div>

      {p.photos && p.photos.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {p.photos.map((url, i) => (
            <div key={url} className="relative aspect-square overflow-hidden bg-ivory-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 bg-ink/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr,18rem]">
        <div>
          <h2 className="font-serif text-2xl">
            {canEdit ? "Edit details" : "Details"}
          </h2>
          <div className="mt-4">
            {canEdit ? (
              <PropertyForm existing={p} currentUserRole={user.role} />
            ) : (
              <>
              <dl className="space-y-2 text-sm">
                <div>Price: {formatKes(p.price)}</div>
                <div>Bedrooms: {p.bedrooms ?? "—"}</div>
                <div>Bathrooms: {p.bathrooms ?? "—"}</div>
                <div>Year built: {p.yearBuilt ?? "—"}</div>
                {p.yearRestored != null && <div>Year restored: {p.yearRestored}</div>}
                <div>Plot size (land): {p.plotSize ?? "—"}</div>
                <div>Built area (house): {p.builtArea ?? "—"}</div>
                <div>Photos: {p.photos?.length ?? 0}</div>
              </dl>
              <div className="mt-6 space-y-5 text-sm">
                {p.description && (
                  <div>
                    <p className="text-eyebrow uppercase text-ash">Description</p>
                    <p className="mt-1 whitespace-pre-wrap">{p.description}</p>
                  </div>
                )}
                {p.highlights && p.highlights.length > 0 && (
                  <div>
                    <p className="text-eyebrow uppercase text-ash">Highlights</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {p.highlights.map((h) => (
                        <li key={h} className="bg-ivory-deep px-2 py-0.5 text-xs">{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.amenities && p.amenities.length > 0 && (
                  <div>
                    <p className="text-eyebrow uppercase text-ash">Amenities</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {p.amenities.map((a) => (
                        <li key={a} className="bg-ivory-deep px-2 py-0.5 text-xs">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.nearby && p.nearby.length > 0 && (
                  <div>
                    <p className="text-eyebrow uppercase text-ash">Nearby</p>
                    <ul className="mt-1 divide-y divide-hairline/10 border-y border-hairline/10">
                      {p.nearby.map((n, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                          <span>{n.place}</span>
                          <span className="text-ash">{n.distance}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </div>

        {canEdit ? (
          <PropertyControls p={p} role={user.role} />
        ) : (
          <p className="text-sm text-ink-mute">
            Read-only — your role cannot change this property.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
