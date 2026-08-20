-- match_documents — pgvector similarity search RPC.
--
-- One generic function: the Tier-1-then-Tier-2 decision (whether Tier 1 results are "sufficient")
-- lives in application code (lib/rag/retrieve.ts), not here, so that threshold can be tuned as the
-- corpus grows without a new migration every time.

create or replace function public.match_documents(
  query_embedding vector(1024),
  match_tier smallint,
  match_count int default 5,
  max_distance float default 0.4
)
returns table (
  id uuid,
  source text,
  tier smallint,
  title text,
  raw_text text,
  distance float
)
language sql
stable
as $$
  select
    d.id, d.source, d.tier, d.title, d.raw_text,
    d.embedding <=> query_embedding as distance
  from public.documents d
  where d.tier = match_tier
    and d.embedding is not null
    and d.embedding <=> query_embedding < max_distance
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Defense in depth: RLS is already forced with no anon/authenticated policies (this function will
-- only ever be called via the service-role admin client), but revoke/grant explicitly so a future
-- policy change can't accidentally expose it.
revoke all on function public.match_documents(vector, smallint, int, float) from public;
grant execute on function public.match_documents(vector, smallint, int, float) to service_role;
