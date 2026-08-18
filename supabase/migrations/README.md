# Supabase Migrations

- `20260818090000_core_schema.sql` — `doctors`, `documents`, `queries`, `citations` tables,
  pgvector extension, constraints, and indexes (spec §6).
- `20260818090100_enable_rls.sql` — row-level security enabled + forced on all four tables.
  No policies yet: all application access goes through the service-role key server-side, since
  there's no doctor-facing login in the MVP (spec §7 Stage 1 is a founder-run manual review queue).

Not yet applied to a live database — no Supabase project is connected this session. Once real
credentials are in `.env.local`, apply with the Supabase CLI (`supabase db push`) or paste into the
project's SQL editor.
