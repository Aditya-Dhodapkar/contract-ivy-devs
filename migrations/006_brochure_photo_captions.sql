-- Page-5 gallery: optional caption per photo. Array indexed alongside
-- properties.photos. Empty/missing entries → tile renders without overlay.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS photo_captions TEXT[];
