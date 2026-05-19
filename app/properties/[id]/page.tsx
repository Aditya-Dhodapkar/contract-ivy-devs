// #19 detail + #20 edit + status/visibility/delete controls. Agents cannot
// open another agent's property (#51). GM sees but the form/controls reject
// writes server-side.

import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { PropertyForm } from "@/components/PropertyForm";
import { PropertyControls } from "@/components/PropertyControls";
import { StatusBadge } from "@/components/StatusBadge";
import { Header } from "@/components/Header";
import { formatUsd } from "@/lib/format";

export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">{p.title || "Untitled"}</h1>
          <p className="text-xs text-ash">
            {p.referenceNumber} · {[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.propertyType || "—"}
          </p>
        </div>
        <StatusBadge status={p.status} />
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
              <PropertyForm existing={p} />
            ) : (
              <>
              <dl className="space-y-2 text-sm">
                <div>Price: {formatUsd(p.price)}</div>
                <div>Bedrooms: {p.bedrooms ?? "—"}</div>
                <div>Bathrooms: {p.bathrooms ?? "—"}</div>
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
                {p.nearby && (
                  <div>
                    <p className="text-eyebrow uppercase text-ash">Nearby & location</p>
                    <p className="mt-1 whitespace-pre-wrap">{p.nearby}</p>
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
