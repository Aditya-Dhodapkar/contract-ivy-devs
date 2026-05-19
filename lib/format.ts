// Currency formatting. Stored as a USD number, displayed as $1,234,567.
// If/when she lists in other currencies, this stays a single place to change.

export function formatUsd(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
