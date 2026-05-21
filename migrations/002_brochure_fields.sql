-- Adds the structured fields the brochure generator needs:
--   - facing direction (compass 8-way)
--   - plot dimensions in metres (for drawing the plot diagram)
--   - per-property toggles to hide map / plot from the brochure (some
--     sellers want exact location withheld, apartments have no plot, etc.)
--
-- Idempotent — safe to re-run.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS facing_direction      TEXT
    CHECK (facing_direction IS NULL OR facing_direction IN ('N','NE','E','SE','S','SW','W','NW')),
  ADD COLUMN IF NOT EXISTS plot_width_meters     NUMERIC,
  ADD COLUMN IF NOT EXISTS plot_length_meters    NUMERIC,
  ADD COLUMN IF NOT EXISTS show_map_on_brochure  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_plot_on_brochure BOOLEAN NOT NULL DEFAULT TRUE;
