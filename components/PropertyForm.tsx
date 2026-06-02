"use client";

// Shared create/edit form (#18, #23–#36). Photos are comma-separated URLs for
// now — real upload comes with media work. Reference number is shown read-only
// when editing; never editable (#22). Price is USD.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PropertyRecord } from "@/lib/repo/properties";
import type { Role } from "@/lib/roles";
import { ChipInput } from "@/components/ChipInput";

const TYPES = ["house", "apartment", "land", "commercial"] as const;

const AMENITY_SUGGESTIONS = [
  // Outdoor / location
  "Swimming pool",
  "Sea view",
  "Beach access",
  "Garden",
  // Utilities / infrastructure (Kenya-specific)
  "Generator",
  "Inverter",
  "Borehole",
  "Solar power",
  "Air conditioning",
  "WiFi",
  // Indoor rooms
  "Fireplace",
  "Wine cellar",
  "Reception room",
  "Guest house",
  "Staff quarters",
  // Access / security / parking
  "Parking",
  "Garage",
  "Security",
  "Gated community",
  "Furnished",
];

const FACING_OPTIONS: { value: import("@/lib/repo/properties").FacingDirection; label: string }[] = [
  { value: "N",  label: "North" },
  { value: "NE", label: "Northeast" },
  { value: "E",  label: "East" },
  { value: "SE", label: "Southeast" },
  { value: "S",  label: "South" },
  { value: "SW", label: "Southwest" },
  { value: "W",  label: "West" },
  { value: "NW", label: "Northwest" },
];

const field =
  "w-full border border-hairline/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-gold";
const label = "block";
const labelText = "mb-1 block text-eyebrow uppercase text-ink";

export function PropertyForm({
  existing,
  currentUserRole,
}: {
  existing?: PropertyRecord;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [assignedAgentId, setAssignedAgentId] = useState<string>(
    existing?.assignedAgentId ?? ""
  );

  // Agents need not pick — server auto-assigns to self.
  const showAgentPicker = currentUserRole !== "agent";

  useEffect(() => {
    if (!showAgentPicker) return;
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((j) => setAgents(j.agents ?? []))
      .catch(() => setAgents([]));
  }, [showAgentPicker]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Controlled "description" state so the AI draft button can populate it
  // from outside the textarea's defaultValue lifecycle. Owner can still
  // edit freely after the AI fills it.
  const [description, setDescription] = useState<string>(existing?.description ?? "");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiDraftError, setAiDraftError] = useState("");
  // Per-photo caption AI state. Keyed by photo URL.
  const [captionLoading, setCaptionLoading] = useState<Record<string, boolean>>({});
  const [bulkCaptioning, setBulkCaptioning] = useState(false);
  const [captionAiError, setCaptionAiError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Snapshot what the form currently knows about the property. Used by
  // the AI draft endpoints (description + caption) so Claude can ground
  // its prose in whatever the owner has filled in.
  function snapshotPropertyContext() {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    const get = (k: string) => (fd ? String(fd.get(k) ?? "").trim() : "");
    const num = (k: string) => {
      const s = get(k);
      return s ? Number(s) : undefined;
    };
    return {
      title: get("title") || undefined,
      propertyType: get("propertyType") || undefined,
      city: get("city") || undefined,
      country: get("country") || undefined,
      bedrooms: num("bedrooms"),
      bathrooms: num("bathrooms"),
      plotSize: get("plotSize") || undefined,
      builtArea: get("builtArea") || undefined,
      facingDirection: get("facingDirection") || undefined,
      yearBuilt: num("yearBuilt"),
      yearRestored: num("yearRestored"),
      restorationNotes: get("restorationNotes") || undefined,
      tenure: get("tenure") || undefined,
      siteCondition: get("siteCondition") || undefined,
      highlights,
      nearby,
    };
  }

  async function draftDescriptionFromAi() {
    setAiDrafting(true);
    setAiDraftError("");
    try {
      const res = await fetch("/api/properties/draft-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshotPropertyContext()),
      });
      const j = (await res.json().catch(() => ({}))) as {
        description?: string;
        error?: string;
      };
      if (!res.ok || !j.description) {
        throw new Error(j.error || `AI draft failed (HTTP ${res.status}).`);
      }
      setDescription(j.description);
    } catch (e) {
      setAiDraftError((e as Error).message);
    } finally {
      setAiDrafting(false);
    }
  }

  // Per-photo caption: drafts a 2-4 word tag from Claude's read of the
  // image. Owner clicks the "✨" button next to a blank caption field.
  async function aiCaptionOne(photoUrl: string) {
    setCaptionLoading((m) => ({ ...m, [photoUrl]: true }));
    setCaptionAiError("");
    try {
      const idx = photos.indexOf(photoUrl);
      const positionHint = idx >= 0 ? `${idx + 1} of ${photos.length}` : undefined;
      const res = await fetch("/api/properties/draft-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl,
          property: snapshotPropertyContext(),
          positionHint,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        caption?: string;
        error?: string;
      };
      if (!res.ok || !j.caption) {
        throw new Error(j.error || `AI caption failed (HTTP ${res.status}).`);
      }
      setCaption(photoUrl, j.caption);
    } catch (e) {
      setCaptionAiError((e as Error).message);
    } finally {
      setCaptionLoading((m) => {
        const { [photoUrl]: _drop, ...rest } = m;
        return rest;
      });
    }
  }

  // Bulk caption: fans the per-photo call out across every photo that
  // is currently blank (cover excluded — its caption is unused). A
  // single photo failing doesn't lose the others.
  async function aiCaptionAllBlanks() {
    const targets = photos.filter((url, i) => {
      if (i === 0) return false; // cover caption is unused
      return !(captionByUrl[url] ?? "").trim();
    });
    if (targets.length === 0) return;
    setBulkCaptioning(true);
    setCaptionAiError("");
    try {
      const res = await fetch("/api/properties/draft-captions-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrls: targets,
          property: snapshotPropertyContext(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        captions?: Array<{ photoUrl: string; caption?: string; error?: string }>;
        error?: string;
      };
      if (!res.ok || !Array.isArray(j.captions)) {
        throw new Error(j.error || `AI captions failed (HTTP ${res.status}).`);
      }
      const failures: string[] = [];
      for (const c of j.captions) {
        if (c.caption) setCaption(c.photoUrl, c.caption);
        else if (c.error) failures.push(c.error);
      }
      if (failures.length) {
        setCaptionAiError(
          `${failures.length} of ${targets.length} captions failed. Use the ✨ button on individual photos to retry.`
        );
      }
    } catch (e) {
      setCaptionAiError((e as Error).message);
    } finally {
      setBulkCaptioning(false);
    }
  }
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  // Captions tracked URL→caption so reorder/remove stays trivial. Persisted
  // as an array indexed alongside `photos` at submit time.
  const [captionByUrl, setCaptionByUrl] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    (existing?.photos ?? []).forEach((url, i) => {
      const cap = existing?.photoCaptions?.[i];
      if (cap) m[url] = cap;
    });
    return m;
  });
  // Pixel dimensions per photo, tracked URL→{w,h} so reorder/remove stays
  // trivial. Drives the orientation badge + the ★-button guard. Older
  // photos without dimensions show no badge; ★ stays enabled (we can't
  // disable a button on missing data).
  const [dimsByUrl, setDimsByUrl] = useState<Record<string, { w: number; h: number }>>(() => {
    const m: Record<string, { w: number; h: number }> = {};
    (existing?.photos ?? []).forEach((url, i) => {
      const d = existing?.photoDimensions?.[i];
      if (d && d.w && d.h) m[url] = d;
    });
    return m;
  });
  const [uploading, setUploading] = useState(0);
  // Multi-image floor plan (1-3 images). Falls back to legacy single
  // `floorPlan` URL for rows saved before the migration.
  const [floorPlans, setFloorPlans] = useState<string[]>(
    existing?.floorPlans && existing.floorPlans.length > 0
      ? existing.floorPlans
      : existing?.floorPlan
        ? [existing.floorPlan]
        : []
  );
  const [uploadingFloorPlan, setUploadingFloorPlan] = useState(false);
  const [highlights, setHighlights] = useState<string[]>(existing?.highlights ?? []);
  const [amenities, setAmenities] = useState<string[]>(existing?.amenities ?? []);
  // Brochure toggles default to true (show by default). Owner unticks per
  // property when the seller asked for the map or plot to be hidden.
  // showMapOnBrochure state was removed when the page-3 variant editor
  // shipped; the editor's Show map / Hide map toggle (with four
  // alternatives) is now the single source of truth. The DB column stays
  // for migration safety but the form no longer touches it — saved
  // properties retain whatever value was last persisted.
  const [showPlotOnBrochure, setShowPlotOnBrochure] = useState<boolean>(
    existing?.showPlotOnBrochure !== false
  );

  // Price as a controlled, comma-grouped string. We keep digits-only in state
  // implicitly by reformatting on every keystroke; the raw number is parsed
  // back out at submit time. Grouping locale fixed to "en" so commas are
  // consistent regardless of the user's browser locale.
  const groupFmt = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
  const [priceDisplay, setPriceDisplay] = useState<string>(
    existing?.price != null ? groupFmt.format(existing.price) : ""
  );
  function onPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setPriceDisplay(digits ? groupFmt.format(Number(digits)) : "");
  }
  // Always normalise to string-typed fields. Inputs need a stable controlled
  // value from the very first render — undefined → string flips React from
  // uncontrolled to controlled and triggers a console warning.
  const normRow = (
    r: { place?: unknown; distance?: unknown; description?: unknown } | undefined | null
  ) => ({
    place: typeof r?.place === "string" ? r.place : "",
    distance: typeof r?.distance === "string" ? r.distance : "",
    description: typeof r?.description === "string" ? r.description : "",
  });
  const [nearby, setNearby] = useState<{ place: string; distance: string; description: string }[]>(
    Array.isArray(existing?.nearby) && existing!.nearby!.length
      ? existing!.nearby!.map(normRow)
      : [{ place: "", distance: "", description: "" }]
  );

  function updateNearby(
    i: number,
    field: "place" | "distance" | "description",
    value: string
  ) {
    setNearby((curr) =>
      curr.map((row, idx) => (idx === i ? { ...normRow(row), [field]: value } : row))
    );
  }
  function addNearby() {
    setNearby((curr) => [...curr, { place: "", distance: "", description: "" }]);
  }
  function removeNearby(i: number) {
    setNearby((curr) =>
      curr.length > 1
        ? curr.filter((_, idx) => idx !== i)
        : [{ place: "", distance: "", description: "" }]
    );
  }
  // Refs are mutated synchronously (no re-render gap) — a real lock against
  // double-clicks. Idempotency key is sent to the server as a second defense.
  const submitting = useRef(false);
  const idempotencyKey = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  );

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setUploading((n) => n + files.length);
    const uploads = Array.from(files).map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as {
        url?: string;
        width?: number;
        height?: number;
        error?: string;
      };
      if (!res.ok || !j.url) throw new Error(j.error || `Upload failed for ${file.name}`);
      return { url: j.url, width: j.width, height: j.height };
    });
    try {
      const uploaded = await Promise.all(uploads);
      setPhotos((curr) => [...curr, ...uploaded.map((u) => u.url)]);
      setDimsByUrl((curr) => {
        const next = { ...curr };
        uploaded.forEach(({ url, width, height }) => {
          if (width && height) next[url] = { w: width, h: height };
        });
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(0);
    }
  }

  function removePhoto(url: string) {
    setPhotos((curr) => curr.filter((u) => u !== url));
    setCaptionByUrl((curr) => {
      if (!(url in curr)) return curr;
      const { [url]: _drop, ...rest } = curr;
      return rest;
    });
    setDimsByUrl((curr) => {
      if (!(url in curr)) return curr;
      const { [url]: _drop, ...rest } = curr;
      return rest;
    });
  }

  /** Classify a photo's orientation. "landscape" → wider than tall by >10%,
   *  "portrait" → taller than wide by >10%, "square" → within 10%,
   *  "unknown" → no dimensions on record (older photos / failed sharp read).
   *  10% tolerance keeps near-square shots out of "landscape" — a 1068×1014
   *  PNG is visually square, not landscape, even though it's technically wider. */
  function orientationOf(url: string): "landscape" | "portrait" | "square" | "unknown" {
    const d = dimsByUrl[url];
    if (!d) return "unknown";
    const ratio = d.w / d.h;
    if (ratio > 1.10) return "landscape";
    if (ratio < 0.90) return "portrait";
    return "square";
  }

  function setCaption(url: string, caption: string) {
    setCaptionByUrl((curr) => {
      if (!caption) {
        if (!(url in curr)) return curr;
        const { [url]: _drop, ...rest } = curr;
        return rest;
      }
      return { ...curr, [url]: caption };
    });
  }

  // Upload one or more floor-plan images. Caps total at 3 (warns owner
  // if she tries to add a 4th); the brochure layout supports 1, 2, or 3.
  async function uploadFloorPlans(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingFloorPlan(true);
    setError("");
    try {
      const slotsRemaining = Math.max(0, 3 - floorPlans.length);
      if (slotsRemaining === 0) {
        setError("Maximum 3 floor-plan images. Remove one to add another.");
        return;
      }
      const accepted = Array.from(files).slice(0, slotsRemaining);
      const dropped = files.length - accepted.length;
      const uploads = await Promise.all(
        accepted.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || "Floor plan upload failed");
          return j.url as string;
        })
      );
      setFloorPlans((curr) => [...curr, ...uploads]);
      if (dropped > 0) {
        setError(
          `Only the first ${accepted.length} uploaded — floor-plan max is 3 images.`
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingFloorPlan(false);
    }
  }

  function removeFloorPlan(url: string) {
    setFloorPlans((curr) => curr.filter((u) => u !== url));
  }

  function setPrimary(url: string) {
    // Cover guard: landscape photos crop badly into the portrait A4 cover.
    // We block setting them as primary; the user must pick a portrait or
    // square photo. Photos with unknown dimensions are allowed through.
    if (orientationOf(url) === "landscape") return;
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
    if (submitting.current) return; // hard block synchronous double-submits
    submitting.current = true;
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      title: f.get("title") || undefined,
      country: f.get("country") || undefined,
      city: f.get("city") || undefined,
      propertyType: f.get("propertyType") || undefined,
      price: priceDisplay ? Number(priceDisplay.replace(/\D/g, "")) : undefined,
      bedrooms: f.get("bedrooms") ? Number(f.get("bedrooms")) : undefined,
      bathrooms: f.get("bathrooms") ? Number(f.get("bathrooms")) : undefined,
      yearBuilt: f.get("yearBuilt") ? Number(f.get("yearBuilt")) : undefined,
      yearRestored: f.get("yearRestored") ? Number(f.get("yearRestored")) : undefined,
      restorationNotes: f.get("restorationNotes") || undefined,
      tenure: f.get("tenure") || undefined,
      shape: f.get("shape") || undefined,
      siteCondition: f.get("siteCondition") || undefined,
      saleTerms: f.get("saleTerms") || undefined,
      topography: f.get("topography") || undefined,
      boundary: f.get("boundary") || undefined,
      services: f.get("services") || undefined,
      floorPlan: floorPlans[0] || undefined,    // legacy single-value field — first image
      floorPlans: floorPlans.length > 0 ? floorPlans : undefined,
      latitude: f.get("latitude") ? Number(f.get("latitude")) : undefined,
      longitude: f.get("longitude") ? Number(f.get("longitude")) : undefined,
      plotSize: f.get("plotSize") || undefined,
      builtArea: f.get("builtArea") || undefined,
      facingDirection: f.get("facingDirection") || undefined,
      plotWidthMeters: f.get("plotWidthMeters") ? Number(f.get("plotWidthMeters")) : undefined,
      plotLengthMeters: f.get("plotLengthMeters") ? Number(f.get("plotLengthMeters")) : undefined,
      showPlotOnBrochure,
      description: f.get("description") || undefined,
      highlights,
      amenities,
      nearby: nearby
        .map(normRow)
        .filter((r) => r.place.trim() || r.distance.trim() || r.description.trim()),
      photos,
      photoCaptions: photos.map((u) => captionByUrl[u] || ""),
      photoDimensions: photos.map((u) => dimsByUrl[u] || null),
    };
    if (showAgentPicker && assignedAgentId) {
      payload.assignedAgentId = assignedAgentId;
    }
    if (!existing) payload.idempotencyKey = idempotencyKey.current;

    const res = await fetch(
      existing ? `/api/properties/${existing.id}` : "/api/properties",
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      }
    );
    if (res.ok) {
      const { property } = await res.json();
      const flag = existing ? "saved" : "created";
      router.push(`/properties/${property.id}?${flag}=1`);
      router.refresh();
      // Intentionally keep submitting/saving=true while the page navigates.
      return;
    }
    const j = await res.json().catch(() => ({}));
    setError(j.error || "Could not save.");
    setSaving(false);
    submitting.current = false;
  }

  const v = existing ?? ({} as Partial<PropertyRecord>);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-2xl space-y-5">
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

      {showAgentPicker && (
        <label className={label}>
          <span className={labelText}>Assigned agent</span>
          <select
            value={assignedAgentId}
            onChange={(e) => setAssignedAgentId(e.target.value)}
            className={field}
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ash">
            Required before this property can be published. Invite agents in Team & roles.
          </p>
        </label>
      )}

      <label className={label}>
        <span className={labelText}>Price (KES)</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ash">
            KSh
          </span>
          <input
            name="price"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={priceDisplay}
            onChange={onPriceChange}
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
          <span className={labelText}>Year built</span>
          <input
            name="yearBuilt"
            type="number"
            min="1800"
            max="2100"
            defaultValue={v.yearBuilt}
            placeholder="e.g. 1995"
            className={field}
          />
        </label>
        <label className={label}>
          <span className={labelText}>Year restored (optional)</span>
          <input
            name="yearRestored"
            type="number"
            min="1800"
            max="2100"
            defaultValue={v.yearRestored}
            placeholder="e.g. 2023"
            className={field}
          />
        </label>
      </div>

      <label className={label}>
        <span className={labelText}>What was restored (one sentence, optional)</span>
        <input
          name="restorationNotes"
          defaultValue={v.restorationNotes}
          placeholder="e.g. Roof, kitchen and all bathrooms; mechanical systems updated."
          className={field}
          maxLength={180}
        />
        <span className="mt-1 block text-xs text-ash">
          Used on the brochure's Provenance page (when she picks that page 3
          option) so the AI describes the restoration accurately instead of
          guessing. Skip if there was no restoration.
        </span>
      </label>

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

      <div className="grid grid-cols-3 gap-4">
        <label className={label}>
          <span className={labelText}>Facing direction</span>
          <select name="facingDirection" defaultValue={v.facingDirection ?? ""} className={field}>
            <option value="">—</option>
            {FACING_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          <span className={labelText}>Plot width (m)</span>
          <input
            name="plotWidthMeters"
            type="number"
            min="0"
            step="0.1"
            defaultValue={v.plotWidthMeters}
            placeholder="e.g. 41"
            className={field}
          />
        </label>
        <label className={label}>
          <span className={labelText}>Plot length (m)</span>
          <input
            name="plotLengthMeters"
            type="number"
            min="0"
            step="0.1"
            defaultValue={v.plotLengthMeters}
            placeholder="e.g. 81"
            className={field}
          />
        </label>
      </div>

      <section className="space-y-4 border-t border-hairline/15 pt-5">
        <p className="text-eyebrow uppercase text-ash">About this property</p>

        <label className={label}>
          <span className="flex items-center justify-between gap-2">
            <span className={labelText}>Description</span>
            <button
              type="button"
              onClick={draftDescriptionFromAi}
              disabled={aiDrafting}
              className="border border-gold-deep px-2 py-1 text-[10px] uppercase tracking-wider text-gold-deep hover:bg-gold-deep hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
              title="Claude reads the rest of the form and drafts 80–120 words of SANSI-voice prose. Owner can edit afterwards."
            >
              {aiDrafting ? "Drafting…" : "✨ Let AI draft this"}
            </button>
          </span>
          <textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={9}
            placeholder="The editorial overview — a short story of the home. Or hit ✨ above and let the AI draft it from the rest of the form."
            className={field}
          />
          {aiDraftError && (
            <span className="mt-1 block text-xs text-red-700">{aiDraftError}</span>
          )}
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

        <div>
          <span className={labelText}>Nearby places</span>
          <ul className="space-y-2">
            {nearby.map((row, i) => (
              <li key={i} className="grid grid-cols-[1fr,1fr,9rem,auto] items-center gap-2">
                <input
                  value={row.place}
                  onChange={(e) => updateNearby(i, "place", e.target.value)}
                  placeholder="Place (e.g. Lamu Airport)"
                  className={field}
                />
                <input
                  value={row.description}
                  onChange={(e) => updateNearby(i, "description", e.target.value)}
                  placeholder="Description (e.g. Diplomatic complex)"
                  className={field}
                />
                <input
                  value={row.distance}
                  onChange={(e) => updateNearby(i, "distance", e.target.value)}
                  placeholder="e.g. 5 min · 3.2 km"
                  className={field}
                />
                <button
                  type="button"
                  onClick={() => removeNearby(i)}
                  title="Remove this row"
                  className="px-2 py-2 text-sm text-ash hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addNearby}
            className="mt-2 border border-dashed border-hairline/30 px-3 py-1.5 text-eyebrow uppercase text-ink-mute hover:bg-paper"
          >
            + Add nearby place
          </button>
        </div>
      </section>

      <div>
        <span className={labelText}>
          Photos {photos.length > 0 && `(${photos.length})`}
        </span>
        <div className="mb-3 border-l-2 border-gold-deep bg-gold/5 px-3 py-2 text-xs text-ink-soft">
          <p>
            <span className="font-medium text-ink">Cover photo:</span> include at
            least one <span className="font-medium">portrait</span> (taller-than-wide)
            shot — landscape photos crop badly on the brochure cover. Hold the phone
            vertically.
          </p>
          <p className="mt-1">
            <span className="font-medium text-ink">Gallery:</span> a mix of
            portrait and landscape gives the best mosaic on page 5. Aim for
            5–8 strong shots: exteriors, interiors, garden, views.
          </p>
          <p className="mt-1">
            <span className="font-medium text-ink">Full brochure budget:</span>{" "}
            upload up to <span className="font-medium">9 photos</span> if you
            want the option of a magazine-style page 3 too — that variant uses
            3 dedicated shots beyond the cover and page-5 gallery (1 cover + 3
            page 3 + 5 page 5 = 9 unique photos, no repeats).
            {" "}
            <span
              className={
                photos.length >= 9
                  ? "font-semibold text-ink"
                  : "font-semibold text-gold-deep"
              }
            >
              {photos.length} / 9 uploaded
              {photos.length >= 9 ? " — ready for any layout." : "."}
            </span>
          </p>
        </div>
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
        {photos.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={aiCaptionAllBlanks}
              disabled={bulkCaptioning}
              className="border border-gold-deep px-3 py-1.5 text-[10px] uppercase tracking-wider text-gold-deep hover:bg-gold-deep hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
              title="Claude reads each photo and writes a 2–4 word editorial tag for every blank caption. Cover photo is skipped (its caption isn't used)."
            >
              {bulkCaptioning ? "Captioning…" : "✨ AI-caption all blanks"}
            </button>
            <span className="text-[11px] text-ash">
              Owner can edit any caption afterwards. 2–4 words each.
            </span>
          </div>
        )}
        {captionAiError && (
          <p className="mt-2 text-xs text-red-700">{captionAiError}</p>
        )}
        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((url, i) => {
              const isPrimary = i === 0;
              const isFirst = i === 0;
              const isLast = i === photos.length - 1;
              const orient = orientationOf(url);
              const canBePrimary = orient !== "landscape"; // unknown allowed
              const orientLabel =
                orient === "portrait" ? "Portrait" :
                orient === "landscape" ? "Landscape" :
                orient === "square" ? "Square" : "";
              const orientClass =
                orient === "landscape"
                  ? "bg-red-700/85 text-paper"
                  : orient === "portrait"
                    ? "bg-green-700/85 text-paper"
                    : "bg-ash/70 text-paper";
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
                    {orientLabel && (
                      <span className={`absolute left-1 bottom-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${orientClass}`}>
                        {orientLabel}
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
                        disabled={!canBePrimary}
                        title={
                          canBePrimary
                            ? "Make this the primary photo"
                            : "Cover photos must be portrait. Landscape photos can't be the primary."
                        }
                        className="flex-1 py-1.5 hover:bg-ivory-deep disabled:cursor-not-allowed disabled:opacity-30"
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
                  <div className="flex items-center gap-1 border-t border-hairline/15 px-2 py-1.5">
                    <input
                      type="text"
                      value={captionByUrl[url] ?? ""}
                      onChange={(e) => setCaption(url, e.target.value)}
                      placeholder={
                        isPrimary
                          ? "Caption (cover — unused)"
                          : "e.g. Sea-facing terrace"
                      }
                      disabled={isPrimary}
                      className="flex-1 bg-transparent text-[11px] text-ink placeholder:text-ash focus:outline-none disabled:text-ash"
                      maxLength={40}
                    />
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => aiCaptionOne(url)}
                        disabled={!!captionLoading[url] || bulkCaptioning}
                        title="Let AI write a 2–4 word caption for this photo."
                        className="shrink-0 text-[11px] text-gold-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {captionLoading[url] ? "…" : "✨"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-ash">
          The primary photo (★) is shown on the website and on the brochure cover.
          Only portrait or square photos can be the primary — landscape ones crop
          badly on the cover. Tap ☆ on any portrait photo to make it the primary.
          Use ← → to reorder, ✕ to remove. Captions are optional — when set,
          they appear as overlays on the brochure gallery page.
        </p>
      </div>

      <section className="space-y-4 border-t border-hairline/15 pt-5">
        <p className="text-eyebrow uppercase text-ash">Coordinates (for brochure map)</p>
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            <span className={labelText}>Latitude</span>
            <input
              name="latitude"
              type="number"
              step="any"
              defaultValue={v.latitude}
              placeholder="e.g. -1.2163"
              className={field}
            />
          </label>
          <label className={label}>
            <span className={labelText}>Longitude</span>
            <input
              name="longitude"
              type="number"
              step="any"
              defaultValue={v.longitude}
              placeholder="e.g. 36.7928"
              className={field}
            />
          </label>
        </div>
        <p className="text-xs text-ash">
          Tip: open Google Maps, right-click the property location, copy the
          coordinates. The brochure renders a stylised map centred on these.
        </p>
      </section>

      <section className="space-y-4 border-t border-hairline/15 pt-5">
        <p className="text-eyebrow uppercase text-ash">Title & sale (used on brochure)</p>
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            <span className={labelText}>Tenure</span>
            <select name="tenure" defaultValue={v.tenure ?? ""} className={field}>
              <option value="">—</option>
              <option value="freehold">Freehold</option>
              <option value="leasehold">Leasehold</option>
            </select>
          </label>
          <label className={label}>
            <span className={labelText}>Shape</span>
            <input
              name="shape"
              defaultValue={v.shape}
              placeholder="e.g. Rectangular, L-shaped, Irregular"
              className={field}
            />
          </label>
        </div>
        <label className={label}>
          <span className={labelText}>Site condition</span>
          <input
            name="siteCondition"
            defaultValue={v.siteCondition}
            placeholder="e.g. Vacant · garden state · fenced"
            className={field}
          />
        </label>
        <label className={label}>
          <span className={labelText}>Sale terms</span>
          <input
            name="saleTerms"
            defaultValue={v.saleTerms}
            placeholder="e.g. Single transaction · single buyer"
            className={field}
          />
        </label>
      </section>

      <section className="space-y-4 border-t border-hairline/15 pt-5">
        <p className="text-eyebrow uppercase text-ash">Site & services (brochure page 4)</p>
        <label className={label}>
          <span className={labelText}>Topography</span>
          <input
            name="topography"
            defaultValue={v.topography}
            placeholder="e.g. Gently sloping, well-drained"
            className={field}
          />
        </label>
        <label className={label}>
          <span className={labelText}>Boundary</span>
          <input
            name="boundary"
            defaultValue={v.boundary}
            placeholder="e.g. Mature hedge & perimeter fence"
            className={field}
          />
        </label>
        <label className={label}>
          <span className={labelText}>Services</span>
          <input
            name="services"
            defaultValue={v.services}
            placeholder="e.g. Mains water · grid power · borehole-ready"
            className={field}
          />
        </label>

        <div>
          <span className={labelText}>
            Site / floor plan {floorPlans.length > 0 && `(${floorPlans.length}/3)`}
          </span>
          {floorPlans.length > 0 && (
            <ul className="mb-3 grid grid-cols-3 gap-2">
              {floorPlans.map((url, i) => (
                <li key={url} className="relative border border-hairline/15 bg-ivory">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Floor plan ${i + 1}`}
                    className="h-32 w-full object-contain"
                  />
                  <span className="absolute left-1 top-1 bg-ink/70 px-1.5 py-0.5 text-[10px] text-paper">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFloorPlan(url)}
                    title="Remove"
                    className="absolute right-1 top-1 bg-paper/85 px-1.5 py-0.5 text-[10px] text-red-700 hover:bg-paper"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {floorPlans.length < 3 && (
            <label className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-hairline/30 bg-ivory px-4 py-6 text-sm text-ink-mute hover:bg-ivory-deep">
              <span>
                {uploadingFloorPlan
                  ? "Uploading…"
                  : floorPlans.length === 0
                    ? "Click to upload a site or floor plan"
                    : `Add another (${floorPlans.length}/3)`}
              </span>
              <span className="mt-1 text-xs text-ash">
                JPG · PNG · WebP · up to 10 MB each · max 3 images
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => uploadFloorPlans(e.target.files)}
              />
            </label>
          )}
          <p className="mt-2 text-xs text-ash">
            Optional. Shown on page 4 of the brochure. 1 image: full panel.
            2 images: stacked. 3 images: two stacked + a third below the
            particulars. <span className="font-medium text-ink-mute">Preferably 2–3 max</span>{" "}
            — site, floor, and one level plan covers most properties.
          </p>
        </div>
      </section>

      <section className="space-y-3 border-t border-hairline/15 pt-5">
        <p className="text-eyebrow uppercase text-ash">Brochure options</p>
        {/* The "Include map location" checkbox lived here until the page-3
            variant editor shipped. That editor (Show map / Hide map +
            four alternatives) is now the single source of truth for page
            3 — the checkbox would only overlap. The showMapOnBrochure DB
            column stays for migration safety but is no longer read. */}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={showPlotOnBrochure}
            onChange={(e) => setShowPlotOnBrochure(e.target.checked)}
            className="mt-1 h-4 w-4 accent-gold-deep"
          />
          <span>
            Include plot diagram on the brochure
            <span className="ml-1 text-xs text-ash">
              — needs width + length above; skip for apartments.
            </span>
          </span>
        </label>
      </section>

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
