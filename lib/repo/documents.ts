// Seam for the pre-publish mandate check (#59). Real document storage is
// Step 3 (#63–#71). Until then this resolves false, so the checklist
// correctly reports the mandate as missing. Step 3 replaces the body only.

export async function hasMandateDoc(_propertyId: string): Promise<boolean> {
  return false;
}
