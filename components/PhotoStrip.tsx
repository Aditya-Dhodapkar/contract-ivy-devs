"use client";

// Horizontal-scrolling photo strip at the top of the property detail page.
// Click any tile → opens a lightbox at full size. Replaces the prior wrapping
// 5-col grid which broke into a second row past 5 photos and gave no way to
// view the image larger.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function PhotoStrip({ photos }: { photos: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Keyboard nav inside the lightbox: ← → cycle, Escape closes.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      else if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
      else if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, photos.length]);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      <div className="mt-8 flex items-center justify-between">
        <p className="text-eyebrow uppercase text-ash">
          Photos · {photos.length}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-eyebrow uppercase text-ash hover:text-gold-deep"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-2 overflow-x-auto [scrollbar-width:thin]">
          <div className="flex gap-2 pb-2">
            {photos.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => setOpenIndex(i)}
                className="relative h-40 w-40 flex-shrink-0 overflow-hidden border border-hairline/15 bg-ivory-deep transition-transform hover:scale-[1.02]"
                title="Click to expand"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 bg-ink/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-paper">
                    Primary
                  </span>
                )}
                <span className="absolute right-1 top-1 bg-ink/70 px-1.5 py-0.5 text-[10px] text-paper">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {openIndex !== null && typeof document !== "undefined" &&
        createPortal(
          <div
            role="presentation"
            onClick={() => setOpenIndex(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 p-6"
          >
            {/* Counter + close */}
            <div className="absolute left-6 top-6 font-mono text-xs uppercase tracking-[0.2em] text-paper/70">
              {openIndex + 1} / {photos.length}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(null);
              }}
              aria-label="Close"
              className="absolute right-6 top-6 font-mono text-xs uppercase tracking-[0.2em] text-paper/80 hover:text-paper"
            >
              Close ✕
            </button>

            {/* Image — stops propagation so clicking the image itself doesn't close */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[openIndex]}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
            />

            {/* Prev/next arrows — only if more than one photo */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
                  }}
                  aria-label="Previous photo"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-ink/40 px-3 py-2 font-serif text-3xl text-paper hover:bg-ink/70"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
                  }}
                  aria-label="Next photo"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-ink/40 px-3 py-2 font-serif text-3xl text-paper hover:bg-ink/70"
                >
                  →
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
