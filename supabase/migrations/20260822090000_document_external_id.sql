-- Supports the PubMed/PMC ingestion integration (lib/ingestion/pubmed.ts): lets a document be
-- traced back to its real source (external_id/source_url) and deduped against re-ingestion of
-- the same PMID.

alter table public.documents add column external_id text;
alter table public.documents add column source_url text;

-- Partial unique index, not a plain unique constraint: PDF-ingested documents have no
-- external_id and shouldn't collide with each other via a shared null-equals-null match.
create unique index documents_source_external_id_idx
  on public.documents (source, external_id)
  where external_id is not null;
