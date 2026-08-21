-- Replaces match_documents: the return shape changes fundamentally (chunk-level fields, not
-- whole-document fields), and documents.embedding no longer exists for the old function to query
-- against — match_documents literally cannot work post-migration. Postgres's CREATE OR REPLACE
-- FUNCTION cannot change a function's return type, so the old function must be dropped first even
-- if we kept the same name; renaming to match_document_chunks while we're at it avoids a
-- confusingly-named function that actually returns chunk rows.

drop function if exists public.match_documents(vector, smallint, int, float);

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
