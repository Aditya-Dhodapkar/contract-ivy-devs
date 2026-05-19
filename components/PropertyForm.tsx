"use client";

// Shared create/edit form (#18, #23–#36). Photos are comma-separated URLs for
// now — real upload comes with media work. Reference number is shown read-only
// when editing; never editable (#22). Price is USD.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/repo/properties";
import { ChipInput } from "@/components/ChipInput";

const TYPES = ["house", "apartment", "land", "commercial"] as const;

const AMENITY_SUGGESTIONS = [
  "Swimming pool",
  "Sea view",
  "Beach access",
  "Garden",
  "Staff quarters",
  "Generator",
  "Borehole",
  "Solar power",
  "Air conditioning",
  "WiFi",
  "Parking",
  "Garage",
  "Security",
  "Gated community",
  "Furnished",
];

const field =
  "w-full border border-hairline/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold";
const label = "block";
const labelText = "mb-1 block text-eyebrow uppercase text-ash";

export function PropertyForm({ existing }: { existing?: PropertyRecord }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const [highlights, setHighlights] = useState<string[]>(existing?.highlights ?? []);
  const [amenities, setAmenities] = useState<string[]>(existing?.amenities ?? []);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading((n) => n + files.length);
    const uploads = Array.from(files).map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Upload failed for ${file.name}`);
      return j.url as string;
    });
    try {
      const urls = await Promise.all(uploads);
      setPhotos((curr) => [...curr, ...urls]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(0);
    }
  }

  function removePhoto(url: string) {
    setPhotos((curr) => curr.filter((u) => u !== url));
  }

  function setPrimary(url: string) {
    setPhotos((curr) => [url, ...curr.filter((u) => u !== url)]);
  }

  function movePhoto(url: string, dir: -1 | 1) {
    setPhotos((curr) => {
      const i = curr.indexOf(url);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= curr.length) return curr;
      const next = [...curr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const payload = {
      title: f.get("title") || undefined,
      country: f.get("country") || undefined,
      city: f.get("city") || undefined,
      propertyType: f.get("propertyType") || undefined,
      price: f.get("price") ? Number(f.get("price")) : undefined,
      bedrooms: f.get("bedrooms") ? Number(f.get("bedrooms")) : undefined,
      bathrooms: f.get("bathrooms") ? Number(f.get("bathrooms")) : undefined,
      plotSize: f.get("plotSize") || undefined,
      builtArea: f.get("builtArea") || undefined,
      description: f.get("description") || undefined,
      highlights,
      amenities,
      nearby: f.get("nearby") || undefined,
      photos,
    };

    const res = await fetch(
      existing ? `/api/properties/${existing.id}` : "/api/properties",
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (res.ok) {
      const { property } = await res.json();
      router.push(`/properties/${property.id}`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not save.");
    }
  }

  const v = existing ?? ({} as Partial<PropertyRecord>);

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      {existing && (
        <p className="text-eyebrow uppercase text-ash">
          Ref {existing.referenceNumber}
        </p>
      )}

      <label className={label}>
        <span className={labelText}>Title</span>
        <input name="title" defaultValue={v.title} className={field} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={label}>
          <span className={labelText}>Country</span>
          <input name="country" defaultValue={v.country ?? "Kenya"} className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>City</span>
          <input name="city" defaultValue={v.city} placeholder="Nairobi, Lamu…" className={field} />
        </label>
      </div>

      <label className={label}>
        <span className={labelText}>Type</span>
        <select name="propertyType" defaultValue={v.propertyType ?? ""} className={field}>
          <option value="">Choose…</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className={label}>
        <span className={labelText}>Price (USD)</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ash">
            US$
          </span>
          <input
            name="price"
            type="number"
            min="0"
            defaultValue={v.price}
            placeholder="0"
            className={field + " pl-12"}
          />
        </div>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={label}>
          <span className={labelText}>Bedrooms</span>
          <input name="bedrooms" type="number" min="0" defaultValue={v.bedrooms} className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Bathrooms</span>
          <input name="bathrooms" type="number" min="0" defaultValue={v.bathrooms} className={field} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={label}>
          <span className={labelText}>Plot size (land)</span>
          <input name="plotSize" defaultValue={v.plotSize} placeholder="e.g. 1 acre" className={field} />
        </label>
        <label className={label}>
          <span className={labelText}>Built area (house)</span>
          <input name="builtArea" defaultValue={v.builtArea} placeholder="e.g. 3,200 sqft" className={field} />
        </label>
      </div>

      <section className="space-y-4 border-t border-hairline/15 pt-5">
        <p className="text-eyebrow uppercase text-ash">About this property</p>

        <label className={label}>
          <span className={labelText}>Description</span>
          <textarea
            name="description"
            defaultValue={v.description}
            rows={4}
            placeholder="The editorial overview — a short story of the home."
            className={field}
          />
        </label>

        <div>
          <span className={labelText}>Highlights</span>
          <ChipInput
            value={highlights}
            onChange={setHighlights}
            placeholder="Type a highlight, press Enter…"
          />
          <p className="mt-1 text-xs text-ash">
            e.g. “Direct beachfront”, “Walking distance to Lamu town”, “Title deed in hand”.
          </p>
        </div>

        <div>
          <span className={labelText}>Amenities</span>
          <ChipInput
            value={amenities}
            onChange={setAmenities}
            placeholder="Add an amenity…"
            suggestions={AMENITY_SUGGESTIONS}
          />
        </div>

        <label className={label}>
          <span className={labelText}>Nearby & location notes</span>
          <textarea
            name="nearby"
            defaultValue={v.nearby}
            rows={3}
            placeholder="e.g. 5 min to airstrip, 20 min to beach club, dhow jetty on the bay."
            className={field}
          />
        </label>
      </section>

      <div>
        <span className={labelText}>
          Photos {photos.length > 0 && `(${photos.length})`}
        </span>
        <label className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-hairline/30 bg-ivory px-4 py-6 text-sm text-ink-mute hover:bg-ivory-deep">
          <span>Click to select photos (multiple)</span>
          <span className="mt-1 text-xs text-ash">
            JPG · PNG · WebP · HEIC · up to 10 MB each
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </label>
        {uploading > 0 && (
          <p className="mt-2 text-xs text-ash">Uploading {uploading}…</p>
        )}
        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((url, i) => {
              const isPrimary = i === 0;
              const isFirst = i === 0;
              const isLast = i === photos.length - 1;
              return (
                <li key={url} className="group overflow-hidden border border-hairline/15 bg-paper">
                  <div className="relative aspect-square bg-ivory-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {isPrimary && (
                      <span className="absolute left-1 top-1 bg-gold-deep px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper">
                        Primary
                      </span>
                    )}
                    <span className="absolute right-1 top-1 bg-ink/70 px-1.5 py-0.5 text-[10px] text-paper">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex divide-x divide-hairline/15 border-t border-hairline/15 text-[11px]">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => movePhoto(url, -1)}
                      title="Move earlier"
                      className="flex-1 py-1.5 hover:bg-ivory-deep disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => movePhoto(url, 1)}
                      title="Move later"
                      className="flex-1 py-1.5 hover:bg-ivory-deep disabled:opacity-30"
                    >
                      →
                    </button>
                    {isPrimary ? (
                      <span
                        title="This is the primary photo"
                        className="flex flex-1 items-center justify-center py-1.5 text-gold-deep"
                      >
                        ★
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimary(url)}
                        title="Make this the primary photo"
                        className="flex-1 py-1.5 hover:bg-ivory-deep"
                      >
                        ☆
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      title="Remove"
                      className="flex-1 py-1.5 text-red-700 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-ash">
          The primary photo (★) is shown on the website and on the brochure cover. Tap ☆ on any other photo to make it the primary. Use ← → to reorder, ✕ to remove.
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        disabled={saving}
        className="bg-ink px-6 py-2.5 text-eyebrow uppercase text-paper hover:bg-gold-deep disabled:opacity-60"
      >
        {saving ? "Saving" : existing ? "Save changes" : "Create property"}
      </button>
    </form>
  );
}
