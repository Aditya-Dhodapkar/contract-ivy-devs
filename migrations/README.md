# Migrations

Plain SQL files applied in order against the Supabase Postgres database.
There is no migration runner — apply manually via the Supabase SQL Editor
(simpler, auditable, and rare enough that automation would be overkill).

## First-time setup

1. Create a Supabase project at <https://supabase.com>. Free tier is fine
   for this scope. Pick a region close to Kenya (Frankfurt / London).
2. Open **SQL Editor** → **New query** → paste `001_init.sql` → **Run**.
3. Open **Storage** → **New bucket** → name `property-photos` (or match
   whatever you set in `SUPABASE_STORAGE_BUCKET`) → set Public.
4. Copy the project URL and `service_role` key from **Project Settings →
   API**. Paste into `.env.local`:

   ```
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_STORAGE_BUCKET=property-photos
   USE_DEV_DATA=false
   ```

5. Restart `npm run dev`. The back-office now reads/writes Supabase.

## Adding a new migration

Append a new file `NNN_short_name.sql`, paste & run the same way. Schema
changes for a deployed system: write them so they're safe to run twice
(`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
