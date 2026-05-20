// Small at-a-glance indicator: is this property live on the public website?
// Pairs with StatusBadge (Draft/Active/Sold/Rented) and ApprovalBadge so a
// glance at the list answers all three questions: approval, sale status,
// public visibility.

export function WebsiteBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-eyebrow uppercase ${
        live ? "bg-green-100 text-green-800" : "bg-ivory-deep text-ink-mute"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green-600" : "bg-ash"}`}
        aria-hidden
      />
      {live ? "Live" : "Not live"}
    </span>
  );
}
