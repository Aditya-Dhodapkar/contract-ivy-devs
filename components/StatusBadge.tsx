import type { PropertyStatus } from "@/lib/repo/properties";

const STYLES: Record<PropertyStatus, string> = {
  draft: "bg-ivory-deep text-ink-mute",
  active: "bg-gold/15 text-gold-deep",
  sold: "bg-ink text-paper",
  rented: "bg-ink text-paper",
};

export function StatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-eyebrow uppercase ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
