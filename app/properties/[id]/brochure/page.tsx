// Brochure preview/edit. Owner/Assistant/GM reach this from a "Create
// brochure" button on the property detail page. Flow:
//   1. Page loads. Auto-fires the /draft endpoint to get Claude's slots.
//   2. Slots populate editable form fields.
//   3. User tweaks anything off-tone.
//   4. "Download PDF" POSTs the (possibly-edited) slots to /pdf and saves
//      the file to disk. Nothing is persisted server-side.

import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getProperty } from "@/lib/repo/properties";
import { Header } from "@/components/Header";
import { BrochureEditor } from "@/components/BrochureEditor";

export default async function BrochurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!can(user.role, "generateBrochure")) redirect(`/properties/${(await params).id}`);

  const { id } = await params;
  const p = await getProperty(id);
  if (!p) notFound();

  return (
    <div className="min-h-screen bg-ivory">
      <Header back={{ href: `/properties/${id}`, label: "Property" }} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-eyebrow uppercase text-ash">Brochure</p>
        <h1 className="mt-3 font-serif text-3xl text-ink">
          {p.title || "Untitled"}{" "}
          <span className="text-ink-mute">· {p.referenceNumber}</span>
        </h1>
        <p className="mt-2 text-sm text-ink-mute">
          Press generate and we'll draft the copy, pull in the photos and map,
          and render a six-page PDF for you. Don't like a phrasing? Press
          generate again — Claude redrafts every time.
        </p>

        <div className="mt-10">
          <BrochureEditor
            propertyId={id}
            photos={p.photos ?? []}
            photoDimensions={p.photoDimensions ?? []}
            photoCaptions={p.photoCaptions ?? []}
            nearbyCount={p.nearby?.length ?? 0}
            hasCoordinates={p.latitude != null && p.longitude != null}
          />
        </div>
      </div>
    </div>
  );
}
