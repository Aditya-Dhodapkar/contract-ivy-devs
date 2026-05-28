// #19 detail + #20 edit + status/visibility/delete controls. Agents cannot
// open another agent's property (#51). GM sees but the form/controls reject
// writes server-side.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { listForProperty as listDocs } from "@/lib/repo/documents";
import { PropertyForm } from "@/components/PropertyForm";
import { PropertyControls } from "@/components/PropertyControls";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { PhotoStrip } from "@/components/PhotoStrip";
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
  const canViewDocs = can(user.role, "viewDocuments", { isOwnerOfRecord });
  const canUploadDocs = can(user.role, "uploadDocument", { isOwnerOfRecord });
  const canDeleteDocs = can(user.role, "deleteDocument");

  // Doc count for the jump-chip near the title. Cheap query (3 rows at most).
  const docCount = canViewDocs ? (await listDocs(p.id)).length : 0;
  const hasMandate = canViewDocs
    ? (await listDocs(p.id)).some((d) => d.docType === "mandate")
    : false;

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: "/properties", label: "Properties" }} />
      <div className="mx-auto max-w-5xl px-6 py-12">
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
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{p.title || "Untitled"}</h1>
          <p className="mt-1 text-sm text-ash">
            {p.referenceNumber} · {[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.propertyType || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ApprovalBadge approval={p.approval} />
          <StatusBadge status={p.status} />
          <WebsiteBadge live={p.showOnWebsite} />
        </div>
      </div>

      {canViewDocs && (() => {
        // Traffic-light gradient by upload count. All four shades pulled from
        // brochure-adjacent tones so the pill stays on-brand. Mandate-missing
        // warning text is orthogonal — it can fire on any count below 3.
        const pillColor =
          docCount === 0 ? "#8a3a3a"       // berry red
          : docCount === 1 ? "#b86b1f"     // burnt orange
          : docCount === 2 ? "#b8923a"     // warm amber
          : "#2d3b2c";                     // forest green
        const tooltip =
          docCount === 3
            ? "All documents uploaded. Jump to the documents section."
            : !hasMandate
              ? "Mandate not uploaded — publishing is blocked. Click to jump to the documents section."
              : `${3 - docCount} document${3 - docCount === 1 ? "" : "s"} still to upload. Jump to the section.`;
        return (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href="#documents"
              style={{ backgroundColor: pillColor, borderColor: pillColor }}
              className="inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-paper shadow-sm transition-opacity hover:opacity-90"
              title={tooltip}
            >
              <span aria-hidden className="text-base">📎</span>
              <span>Documents · {docCount}/3</span>
              {!hasMandate && (
                <span className="border-l border-paper/40 pl-2.5 text-xs font-normal normal-case tracking-normal">
                  ⚠ mandate missing
                </span>
              )}
              {docCount === 3 && (
                <span className="border-l border-paper/40 pl-2.5 text-xs font-normal normal-case tracking-normal">
                  ✓ complete
                </span>
              )}
              <span aria-hidden className="ml-1">↓</span>
            </a>
          </div>
        );
      })()}

      {p.photos && p.photos.length > 0 && (
        <PhotoStrip photos={p.photos} />
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr,19rem]">
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
                <div>Facing: {p.facingDirection ?? "—"}</div>
                <div>Plot size (land): {p.plotSize ?? "—"}</div>
                <div>Built area (house): {p.builtArea ?? "—"}</div>
                {p.plotWidthMeters != null && p.plotLengthMeters != null && (
                  <div>Plot dimensions: {p.plotWidthMeters} m × {p.plotLengthMeters} m</div>
                )}
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
          // self-start prevents the grid from stretching the sidebar to match
          // the (taller) PropertyForm column. Without it the bordered paper
          // panel runs ~600px past its last button.
          <div className="self-start">
            <PropertyControls p={p} role={user.role} />
          </div>
        ) : (
          <p className="text-sm text-ink-mute">
            Read-only — your role cannot change this property.
          </p>
        )}
      </div>

      {canViewDocs && (
        <DocumentsPanel
          propertyId={p.id}
          canUpload={canUploadDocs}
          canDelete={canDeleteDocs}
        />
      )}
      </div>
    </div>
  );
}
