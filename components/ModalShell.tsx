"use client";

// Themed modal shell that replaces native confirm() / prompt() everywhere.
// Renders to document.body via portal so parent overflow / z-index can't clip
// it. Escape closes; backdrop click closes; body scroll is locked while open.

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function ModalShell({
  open,
  onClose,
  title,
  children,
  actions,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
  /** Max-width preset. "md" (default, ~448px) for confirmations and short
   *  forms. "lg" (~720px) for previews / image grids that benefit from
   *  more horizontal room. */
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className={
          "w-full border border-hairline/25 bg-paper p-7 shadow-[0_8px_32px_rgba(20,19,15,0.18)] " +
          (size === "lg" ? "max-w-3xl" : "max-w-md")
        }
      >
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
        <div className="mt-4 text-sm text-ink-mute">{children}</div>
        <div className="mt-7 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>,
    document.body
  );
}

/* Small button presets so callsites stay tidy. */

export const modalBtnCancel =
  "border border-hairline/30 px-4 py-2 text-eyebrow uppercase text-ink-mute hover:bg-ivory-deep";
export const modalBtnPrimary =
  "bg-ink px-4 py-2 text-eyebrow uppercase text-paper hover:bg-gold-deep disabled:opacity-40";
export const modalBtnDanger =
  "bg-red-700 px-4 py-2 text-eyebrow uppercase text-paper hover:bg-red-800 disabled:opacity-40";
