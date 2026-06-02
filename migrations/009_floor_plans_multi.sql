-- Multi-image floor plan. Owners typically have 1-3 floor-plan drawings
-- (site / floor / level overlays). Previously we stored a single URL on
-- properties.floor_plan; that's now augmented with a text[] column.
--
-- Read order in the app: floor_plans (new) takes priority; if empty,
-- fall back to floor_plan (legacy single value). Saving from the form
-- writes the array and clears the legacy column. Old rows continue to
-- render until they're re-saved.
-- Idempotent.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS floor_plans TEXT[];
