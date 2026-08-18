# Supabase Migrations (not yet implemented)

Will hold SQL migrations for the core schema (spec §6):

- `doctors` — id, name, NMC/state council reg number, verification_status, verification_method, created_at
- `documents` — id, source, tier (1 or 2), title, raw_text, embedding, ingested_at
- `queries` — id, doctor_id, query_text, response_text, citations[], response_time_ms, created_at
- `citations` — id, query_id, document_id, claim_text

Row-level security must be enabled on all tables before any pilot use (spec §9).
