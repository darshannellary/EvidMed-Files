-- Adds page and section location metadata to document_chunks, so a citation can point a doctor
-- to roughly where in a source a claim came from — not just which document.
--
-- page_start/page_end (not a single page_number): a chunk can span more than one PDF page once
-- paragraph-aware chunking packs multiple paragraphs together (lib/ingestion/chunk.ts), so a
-- range is the honest shape — collapsing to a single number would silently pick one endpoint and
-- imply false precision. Both null for chunks with no page concept at all (PMC BioC full text).
--
-- section is a best-effort structural label, populated only where lib/ingestion/pubmed.ts derives
-- one from BioC's own section_type — never guessed from PDF prose. Null is the honest default and
-- the expected value for most Tier-1 PDF-derived chunks.
alter table public.document_chunks add column page_start int;
alter table public.document_chunks add column page_end int;
alter table public.document_chunks add column section text;

-- match_document_chunks needs to return the new columns for retrieval/citation display — same
-- "return type changed, must drop and recreate" constraint as the prior migration that introduced
-- this function (see 20260821130100_match_document_chunks_function.sql's header comment).
drop function if exists public.match_document_chunks(vector, smallint, int, float);

create or replace function public.match_document_chunks(
  query_embedding vector(1024),
  match_tier smallint,
  match_count int default 5,
  max_distance float default 0.4
)
returns table (
  chunk_id uuid,
  document_id uuid,
  chunk_index int,
  chunk_text text,
  source text,
  tier smallint,
  title text,
  page_start int,
  page_end int,
  section text,
  distance float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    c.chunk_index,
    c.chunk_text,
    d.source,
    d.tier,
    d.title,
    c.page_start,
    c.page_end,
    c.section,
    c.embedding <=> query_embedding as distance
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.tier = match_tier
    and c.embedding is not null
    and c.embedding <=> query_embedding < max_distance
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_document_chunks(vector, smallint, int, float) from public;
grant execute on function public.match_document_chunks(vector, smallint, int, float) to service_role;
