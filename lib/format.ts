// Currency formatting. Price is stored as a KES number, displayed as
// "KSh 1,234,567". Kept in one place so if she ever lists in another
// currency we only change this file.

export function formatKes(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}
