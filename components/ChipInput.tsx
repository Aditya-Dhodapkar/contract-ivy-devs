"use client";

// Tag/chip editor. Type and press Enter (or comma) to add. Click a chip to
// remove. Optional `suggestions` show as dashed "+ chip" pills below — click
// one to add it. Used for highlights and amenities on the property form.

import { useState } from "react";

export function ChipInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  variant = "default",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  /** Visual variant. "default" = cream chips (highlights, amenities).
   *  "accent" = forest-green left bar (site & services), so those fields
   *  read as a different family from amenities. */
  variant?: "default" | "accent";
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const s = raw.trim();
    if (!s || value.includes(s)) {
      setDraft("");
      return;
    }
    onChange([...value, s]);
    setDraft("");
  }
  function remove(s: string) {
    onChange(value.filter((x) => x !== s));
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  const available = suggestions.filter((s) => !value.includes(s));

  // Two visual families. "accent" gives chips a forest-green left bar so
  // site-and-services fields look distinct from amenities even though they
  // share the same input mechanics.
  const chipClass =
    variant === "accent"
      ? "group flex items-center gap-1 border-l-2 border-l-[#2d3b2c] bg-ivory-deep/70 px-2 py-0.5 text-xs text-ink hover:bg-red-100"
      : "group flex items-center gap-1 bg-ivory-deep px-2 py-0.5 text-xs text-ink hover:bg-red-100";
  const suggestionClass =
    variant === "accent"
      ? "border border-dashed border-[#2d3b2c]/40 px-2 py-0.5 text-xs text-[#2d3b2c]/80 hover:bg-[#2d3b2c]/5 hover:text-[#2d3b2c]"
      : "border border-dashed border-hairline/30 px-2 py-0.5 text-xs text-ink-mute hover:bg-paper hover:text-ink";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border border-hairline/20 bg-ivory px-2 py-1.5">
        {value.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => remove(s)}
            className={chipClass}
            title="Remove"
          >
            {s} <span className="text-ash group-hover:text-red-700">×</span>
          </button>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
      </div>
      {available.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={suggestionClass}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
