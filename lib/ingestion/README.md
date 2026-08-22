# Document Ingestion Pipeline

Two ways to get a document in: a manual PDF (any Tier-1 or Tier-2 source) or an automated pull
from PubMed/PMC (Tier-2 `PubMedCentral` only). Both extract text, split it into paragraph-aware
chunks (`lib/ingestion/chunk.ts`), embed each chunk via Voyage AI (`voyage-3-large`, 1024 dims),
and insert the document into `documents` and its chunks (with per-chunk embeddings) into
`document_chunks`, using the service-role admin client (RLS has no anon/authenticated write
policies, so this is the only write path — see `supabase/migrations/20260818090100_enable_rls.sql`
and `20260821130000_document_chunks_schema.sql`). The chunk→embed→insert steps are shared code
(`ingestExtractedText` in `lib/ingestion/pipeline.ts`) — only how the raw text gets extracted
differs between the two paths.

## Usage: manual PDF

```bash
npm run ingest -- ./samples/icmr-tb-guidelines.pdf --source=ICMR --tier=1 --title="TB Guidelines 2024"
```

Valid `--source` values and their required `--tier`:

| Source                   | Tier |
| ------------------------- | ---- |
| ICMR                      | 1    |
| NHM                       | 1    |
| NCDC                      | 1    |
| EssentialMedicinesList    | 1    |
| PubMedCentral             | 2    |
| Cochrane                  | 2    |
| medRxiv                   | 2    |

Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `VOYAGE_API_KEY` in
`.env.local`.

## Usage: PubMed / PMC (Tier 2 only)

Two-step, founder-curated workflow — nothing is ingested automatically. First, search and review:

```bash
npm run pubmed:search -- "tuberculosis treatment guidelines" [--max=20]
```

Prints a numbered list (PMID, title, journal, publication date). Pick one, then ingest it by PMID:

```bash
npm run pubmed:ingest -- --pmid=12345678 [--title="Override title"]
```

If `--title` is omitted, the article's real title (from PubMed) is used automatically.

**Full-text only, no abstract fallback.** Only articles in PMC's Open Access Subset — the subset
NCBI's terms allow full-text reuse of — can be ingested. If a PMID has no PMC record at all, or is
in PMC but not in the OA subset, `pubmed:ingest` refuses and says exactly why, rather than silently
substituting a thin ~250-word abstract as if it were a substantive Tier-2 source.

Requires `NCBI_API_EMAIL` in `.env.local` (NCBI's usage policy expects a contact email on every
request — free, no signup needed for this alone). `NCBI_API_KEY` is optional and only raises the
rate limit from 3 req/sec to 10/sec; not needed for this founder-run, one-at-a-time workflow.

Documents ingested this way get `external_id` (the PMID) and `source_url` (the canonical PMC
article link) populated — re-running `pubmed:ingest` on an already-ingested PMID is rejected with
a clear "already ingested as document {id}" error, not a silent duplicate.

**Response shapes for NCBI's esearch/esummary/ID-Converter/BioC-PMC APIs (`lib/ingestion/pubmed.ts`)
are built from their documented formats, not verified against a live call** — no real
`NCBI_API_EMAIL`/network access exists in this session's sandbox. Treat the first real
`pubmed:search`/`pubmed:ingest` run as the actual verification of these assumptions.

## Chunking

Each document's extracted text is split by `lib/ingestion/chunk.ts`'s `chunkText()`: paragraph-aware
packing into ~4000-char chunks (`CHUNK_CHAR_BUDGET`) with a 400-char overlap between consecutive
chunks (`CHUNK_OVERLAP_CHARS`), and a hard-split fallback for a single paragraph that itself exceeds
the budget (e.g. OCR output with no real paragraph breaks). Chunks are embedded in batches of
`EMBED_BATCH_SIZE=32` per Voyage call — this is an easily-tunable placeholder, **not verified
against Voyage's actual current per-request limits** (no live network access to check from this
sandbox); sanity-check it before ingesting an unusually large document.

If an embedding batch fails, that batch's chunks are still inserted with `embedding: null`
(two-phase fallback, scoped per-batch rather than per-document — a transient failure only nulls out
~32 chunks). Run the backfill afterward to fill in any missing embeddings once Voyage is reachable:

```bash
npm run ingest:backfill-embeddings
```

**Non-atomic insert**: the parent `documents` row and its `document_chunks` rows are two separate
inserts, no transaction. If the chunk insert fails after the document insert succeeds, you get a
`documents` row with zero chunks — invisible to retrieval, with no auto-cleanup. Re-ingest under a
fresh title if this happens (check `npm run ingest`'s output/logs).

## Known gaps

- **No OCR.** If a PDF is scanned/image-only, extraction fails loudly (empty text) or warns loudly
  (low text yield per page) rather than silently ingesting garbage. Whether real ICMR/NHM/NCDC PDFs
  need OCR is unknown until real sample documents are tested — build note in the tech spec calls
  this "the most tedious, least AI-magic part of the build."
