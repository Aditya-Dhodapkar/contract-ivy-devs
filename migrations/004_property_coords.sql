-- Coordinates for the brochure's locality-map embed. Optional — the
-- location page just hides the map block when these are absent.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;
