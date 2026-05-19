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
            {p.referenceNumber} · {p.region || "—"} · {p.propertyType || "—"}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr,18rem]">
        <div>
          <h2 className="font-serif text-2xl">
            {canEdit ? "Edit details" : "Details"}
          </h2>
          <div className="mt-4">
            {canEdit ? (
              <PropertyForm existing={p} />
            ) : (
              <dl className="space-y-2 text-sm">
                <div>Price: {p.price ?? "—"}</div>
                <div>Bedrooms: {p.bedrooms ?? "—"}</div>
                <div>Bathrooms: {p.bathrooms ?? "—"}</div>
                <div>Plot size: {p.plotSize ?? "—"}</div>
                <div>Description: {p.description ?? "—"}</div>
                <div>Photos: {p.photos?.length ?? 0}</div>
              </dl>
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
