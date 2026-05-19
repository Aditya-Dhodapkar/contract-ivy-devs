"use client";

// Shared create/edit form (#18, #23–#36). Photos accepted as comma-separated
// URLs for now — real image upload comes with document/media work. Reference
// number is shown read-only when editing; never editable (#22).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/repo/properties";

const TYPES = ["house", "apartment", "land", "commercial"] as const;

export function PropertyForm({ existing }: { existing?: PropertyRecord }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const payload = {
      title: f.get("title") || undefined,
      region: f.get("region") || undefined,
      propertyType: f.get("propertyType") || undefined,
      price: f.get("price") ? Number(f.get("price")) : undefined,
      bedrooms: f.get("bedrooms") ? Number(f.get("bedrooms")) : undefined,
      bathrooms: f.get("bathrooms") ? Number(f.get("bathrooms")) : undefined,
      plotSize: f.get("plotSize") || undefined,
      description: f.get("description") || undefined,
      photos: String(f.get("photos") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
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
  const field =
    "w-full border border-hairline/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold";

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4">
      {existing && (
        <p className="text-eyebrow uppercase text-ash">
          Ref {existing.referenceNumber}
        </p>
      )}
      <input name="title" defaultValue={v.title} placeholder="Title" className={field} />
      <input name="region" defaultValue={v.region} placeholder="Region" className={field} />
      <select name="propertyType" defaultValue={v.propertyType ?? ""} className={field}>
        <option value="">Type…</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input name="price" type="number" defaultValue={v.price} placeholder="Price" className={field} />
      <div className="flex gap-3">
        <input name="bedrooms" type="number" defaultValue={v.bedrooms} placeholder="Bedrooms" className={field} />
        <input name="bathrooms" type="number" defaultValue={v.bathrooms} placeholder="Bathrooms" className={field} />
      </div>
      <input name="plotSize" defaultValue={v.plotSize} placeholder="Plot size" className={field} />
      <textarea name="description" defaultValue={v.description} placeholder="Description" rows={4} className={field} />
      <input
        name="photos"
        defaultValue={v.photos?.join(", ")}
        placeholder="Photo URLs (comma-separated)"
        className={field}
      />
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
