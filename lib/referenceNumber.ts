// Deliverable #22. The reference number is the single source of truth across
// website, back office, and brochure (brief non-negotiable #5). Format:
// SA-<year>-NNN, zero-padded to 3, sequential per calendar year, immutable
// once assigned. Pure — the repo supplies the existing numbers.

const PREFIX = "SA";
const RE = /^SA-(\d{4})-(\d{3,})$/;

export function isValidReference(ref: string): boolean {
  return RE.test(ref);
}

/**
 * Given every reference already issued, return the next one for `year`.
 * Sequence restarts at 001 each year. Ignores malformed/other-year entries.
 */
export function nextReference(existing: string[], year: number): string {
  let max = 0;
  for (const ref of existing) {
    const m = RE.exec(ref);
    if (m && Number(m[1]) === year) {
      const n = Number(m[2]);
      if (n > max) max = n;
    }
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${PREFIX}-${year}-${seq}`;
}
