-- Photo dimensions captured at upload time. Parallel array to `photos`,
-- aligned by index. Each entry is `{ w: number, h: number }`.
-- Used to:
--   1. Block landscape photos from being the brochure cover (page 1)
--   2. Match photos to gallery tile aspect ratios on page 5
-- Older photos without dimensions still render — code falls back to
-- treating dimensions as unknown.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS photo_dimensions JSONB;
