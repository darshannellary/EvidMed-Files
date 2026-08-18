-- EvidMed AI — core schema
--
-- Standing rule for this file and every migration that follows: no column here may ever hold
-- patient-identifying data. DPDP-by-default is a product principle, not a one-time check.

create extension if not exists vector;

-- doctors ---------------------------------------------------------------------------------------

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_council text not null, -- 'NMC' or a specific state medical council
  registration_number text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_method text
    check (verification_method is null or verification_method in ('auto', 'manual')),
  -- Nullable, unpopulated in the MVP (no doctor-facing login yet — verification is a founder-run
  -- manual queue, spec §7 Stage 1). Kept as a cheap hedge so a future login flow doesn't require
  -- a destructive migration.
  user_id uuid unique references auth.users (id),
  created_at timestamptz not null default now(),

  unique (registration_council, registration_number)
);

create index doctors_verification_status_idx on public.doctors (verification_status);

-- documents ---------------------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  source text not null
    check (
      source in (
        'ICMR', 'NHM', 'NCDC', 'EssentialMedicinesList',
        'PubMedCentral', 'Cochrane', 'medRxiv'
      )
    ),
  tier smallint not null check (tier in (1, 2)),
  title text not null,
  -- Nullable: a two-phase ingestion pipeline creates the row at extraction time and backfills
  -- raw_text/embedding asynchronously (extraction QA on scanned Tier-1 PDFs is the slow part).
  raw_text text,
  embedding vector(1024), -- voyage-3-large, 1024 dimensions
  ingested_at timestamptz not null default now(),

  -- Encodes spec §8's tier/source mapping so ingestion can't miswire a source into the wrong tier.
  check (
    (tier = 1 and source in ('ICMR', 'NHM', 'NCDC', 'EssentialMedicinesList'))
    or
    (tier = 2 and source in ('PubMedCentral', 'Cochrane', 'medRxiv'))
  )
);

create index documents_tier_source_idx on public.documents (tier, source);

-- HNSW over IVFFlat: IVFFlat needs a tuned list-count against a representative row count and has
-- poor recall on a near-empty table — exactly the Phase 0 situation with only 10-20 sample docs.
-- HNSW builds incrementally and doesn't need pre-existing volume. Voyage embeddings compare via
-- cosine similarity, so application code must use the `<=>` operator to match this index.
create index documents_embedding_hnsw_idx
  on public.documents using hnsw (embedding vector_cosine_ops);

-- queries ---------------------------------------------------------------------------------------

create table public.queries (
  id uuid primary key default gen_random_uuid(),
  -- DPDP right-to-erasure: a deleted doctor's query history is deleted with them.
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  query_text text not null,
  -- Nullable: insert-on-submit, update-on-completion so response_time_ms is measured accurately.
  response_text text,
  response_time_ms integer,
  created_at timestamptz not null default now()
);

create index queries_doctor_id_idx on public.queries (doctor_id);

-- citations ---------------------------------------------------------------------------------------

create table public.citations (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.queries (id) on delete cascade,
  -- restrict, not cascade: a cited document can't be hard-deleted while referenced, preserving
  -- the audit trail needed for Phase 3's "medical board spot-checks citation accuracy".
  document_id uuid not null references public.documents (id) on delete restrict,
  claim_text text not null
);

create index citations_query_id_idx on public.citations (query_id);
create index citations_document_id_idx on public.citations (document_id);
