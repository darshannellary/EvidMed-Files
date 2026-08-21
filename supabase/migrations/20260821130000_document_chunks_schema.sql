-- Document chunking (spec: "improve Ask AI... more documents in the RAG ingestion" — chunking is
-- built now, before more documents are added, because a longer/bigger corpus is exactly what
-- exposes the one-embedding-per-whole-document limitation. See lib/ingestion/chunk.ts for the
-- chunking algorithm and lib/rag/README.md for how retrieval consumes this table.

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  -- cascade, not restrict: unlike citations.document_id (which protects an audit trail — see
  -- below), a chunk is derived/regenerable data with no independent meaning once its parent
  -- document is gone. Deleting a document should not require deleting its chunks first by hand.
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1024), -- voyage-3-large, 1024 dims; nullable for the same two-phase
                           -- insert-then-backfill resilience pattern documents.embedding used.
  created_at timestamptz not null default now(),

  unique (document_id, chunk_index)
);

create index document_chunks_document_id_idx on public.document_chunks (document_id);

-- Same HNSW-over-IVFFlat reasoning as documents_embedding_hnsw_idx (see core_schema.sql): HNSW
-- builds incrementally and doesn't need pre-existing volume or list-count tuning, which matters
-- more than ever now that a near-empty corpus is exactly the state chunking launches into.
create index document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

alter table public.document_chunks enable row level security;
alter table public.document_chunks force row level security;
-- Zero policies for anon/authenticated — same deny-all-except-service-role stance as every other
-- table (see 20260818090100_enable_rls.sql's header comment). Doctors never get direct corpus
-- access, chunked or not — only synthesized, cited answers.

-- documents.embedding is now dead: every embedding lives in document_chunks, keyed one-per-chunk
-- instead of one-per-document. Dropping cleanly rather than leaving it nullable-and-unused matches
-- this codebase's own established convention of not carrying dead columns (e.g. queries.citations
-- was deliberately never added rather than left unused — see core_schema.sql's queries comment).
drop index if exists public.documents_embedding_hnsw_idx;
alter table public.documents drop column embedding;

-- citations: add chunk_id alongside the existing document_id, not replacing it. document_id stays
-- NOT NULL and still populated on every future citation (denormalized-but-convenient — lets any
-- document-scoped query skip a join through document_chunks). chunk_id is nullable because live
-- citation rows from real testing already done this session predate chunking and have no chunk to
-- backfill against — a non-destructive additive migration is correct here, a breaking replace of
-- document_id would orphan those rows for no benefit.
alter table public.citations
  add column chunk_id uuid references public.document_chunks (id) on delete restrict;
-- restrict, matching document_id's existing restrict: a cited chunk can't be hard-deleted while
-- referenced, for the same "medical board spot-checks citation accuracy" reason (core_schema.sql).
-- No gap between the two FKs: citations.document_id's own restrict fires independently of
-- document_chunks.document_id's cascade, so a cited document can never be hard-deleted regardless
-- of which FK Postgres evaluates.

create index citations_chunk_id_idx on public.citations (chunk_id);
