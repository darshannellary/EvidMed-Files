# RAG Query Flow

Embeds a doctor's question, runs a Tier-1-then-Tier-2 pgvector similarity search over
`document_chunks`, and has Claude synthesize an answer with mandatory inline citations (`[1]`,
`[2]`...) mapped back to the retrieved chunks (and their parent documents). Writes the result to
`queries` and `citations` via the service-role admin client.

## Usage

There's no doctor login yet (spec §7 Stage 1 — verification is a founder-run manual queue, not yet
built), so this runs as a CLI against a real `doctors.id`, not a web page:

```bash
npm run query -- --doctor-id=<uuid> "What is the recommended first-line treatment for..."
```

To get a `--doctor-id` to test with, insert a throwaway test doctor via the Supabase SQL editor:

```sql
insert into public.doctors (name, registration_council, registration_number, verification_status, verification_method)
values ('TEST - DO NOT USE', 'NMC', 'TEST-0001', 'verified', 'manual')
returning id;
```

(Safe to delete later — `queries.doctor_id` cascades on delete by design, for DPDP right-to-erasure.)

Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VOYAGE_API_KEY`, and
`ANTHROPIC_API_KEY` in `.env.local`.

## How retrieval works

- Documents are split into paragraph-aware chunks at ingestion time (see
  `lib/ingestion/README.md`); each chunk gets its own embedding. Retrieval matches against
  `document_chunks`, not whole documents — so a long guideline's specific relevant section can
  surface even if the rest of the document is about something else.
- The query is embedded with Voyage's `input_type: "query"` (chunks were ingested with
  `input_type: "document"` — Voyage's asymmetric embeddings are designed for this comparison to be
  meaningful).
- Tier 1 sources (ICMR/NHM/NCDC/EssentialMedicinesList) are always searched first via the
  `match_document_chunks` Postgres function. If Tier 1 returns enough results, Tier 2 is never
  queried — the concrete enforcement of "India-grounded first."
- Retrieved chunks are capped at 8 total to keep the prompt small for the product's <10 second
  response target.
- Multiple chunks from the same parent document can legitimately both appear in one retrieval
  result — structurally impossible before chunking (one row, one embedding, per whole document).
  This is the direct mechanism by which chunking improves retrieval and citation precision: two
  different sections of the same guideline, each relevant to a different facet of a query, can now
  both surface and both get cited independently (see "How citation enforcement works" below). When
  this happens, the prompt labels the entries `(excerpt 1 of 2)`, `(excerpt 2 of 2)`, etc.

## How citation enforcement works

The system prompt requires every claim to carry a `[n]` marker, or — when the retrieved sources
genuinely don't answer the question, including when nothing was retrieved at all — an exact
`NO_RELEVANT_SOURCES` sentinel instead. This is not trusted alone: `lib/rag/validate.ts`
mechanically checks the response has at least one marker (or is exactly the sentinel) and that
every marker points at an actually-retrieved chunk. If validation fails, Claude gets one retry
with a corrective instruction; if that also fails, the query is left with `response_text: null` (a
legible failed-attempt record) and the CLI exits non-zero — "No-Citation, No-Output" enforced in
code, not just prompted for. `pipeline.ts` also short-circuits before calling Claude at all when
retrieval returns zero chunks, and logs retrieved chunk count/tier/distance to stderr.

Citation granularity is per-chunk, not per-document: two different chunks of the same document,
cited in two different sentences, now correctly produce two separate `citations` rows (same
`document_id`, different `chunk_id`, each with its own `claim_text`) — this resolves the
previously-flagged "per-document, not per-claim" gap. Residual, still-accepted coarseness: the
*same* chunk cited across two non-contiguous sentences still collapses into one row (the
aggregation key is chunk index, not sentence index).

## Known gaps

- **`max_distance: 0.75` was calibrated from a single true-positive measured against a
  whole-document embedding, before chunking existed** — that 0.5451 data point is not the same
  experiment as chunk-level retrieval and shouldn't be treated as chunk-level calibration evidence.
  A chunk-level embedding represents a much narrower slice of content than the old whole-document
  average, so genuine matches should cluster measurably closer to 0 — this needs re-verification
  once real chunked data exists, not assumed to still be the right number.
- **`MIN_TIER1_RESULTS: 1`** is sized for a still-small/early corpus overall (not specifically "one
  document" anymore — even one ingested document now produces many chunks). Raise as more
  documents are ingested.
- **`EMBED_BATCH_SIZE=32`** (in `lib/ingestion/pipeline.ts`) is an unverified placeholder against
  Voyage's actual current per-request limits — see `lib/ingestion/README.md`.
- **No web UI yet for the CLI-driven query flow above** — the actual doctor-facing query
  experience is `/ask` (see `app/ask/`), which calls `answerQuery()` from `lib/rag/pipeline.ts`
  directly; this README's CLI usage section is for founder/dev testing against a specific
  `doctor_id`, not the primary user-facing path.
