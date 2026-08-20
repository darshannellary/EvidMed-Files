# RAG Query Flow

Embeds a doctor's question, runs a Tier-1-then-Tier-2 pgvector similarity search, and has Claude
synthesize an answer with mandatory inline citations (`[1]`, `[2]`...) mapped back to the retrieved
`documents` rows. Writes the result to `queries` and `citations` via the service-role admin client.

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

- The query is embedded with Voyage's `input_type: "query"` (documents were ingested with
  `input_type: "document"` — Voyage's asymmetric embeddings are designed for this comparison to be
  meaningful). **Confirmed working against real data**: a real query against the one real ingested
  document measured a cosine distance of 0.5451 and correctly retrieved it.
- Tier 1 sources (ICMR/NHM/NCDC/EssentialMedicinesList) are always searched first via the
  `match_documents` Postgres function. If Tier 1 returns enough results, Tier 2 is never queried —
  the concrete enforcement of "India-grounded first."
- Retrieved documents are capped at 8 total to keep the prompt small for the product's <10 second
  response target.

## How citation enforcement works

The system prompt requires every claim to carry a `[n]` marker, or — when the retrieved sources
genuinely don't answer the question, including when nothing was retrieved at all — an exact
`NO_RELEVANT_SOURCES` sentinel instead. This is not trusted alone: `lib/rag/validate.ts`
mechanically checks the response has at least one marker (or is exactly the sentinel) and that
every marker points at an actually-retrieved document. If validation fails, Claude gets one retry
with a corrective instruction; if that also fails, the query is left with `response_text: null` (a
legible failed-attempt record) and the CLI exits non-zero — "No-Citation, No-Output" enforced in
code, not just prompted for. `pipeline.ts` also short-circuits before calling Claude at all when
retrieval returns zero documents, and logs retrieved document count/tier/distance to stderr.

## Known gaps

- **`max_distance: 0.75` is a rough calibration from a single true-positive**, not a properly tuned
  threshold — see above. There's no observed true-negative yet (the corpus has one document), so
  there's no data on how well this excludes genuinely irrelevant matches. Revisit once more
  documents and more varied real queries exist.
- **`MIN_TIER1_RESULTS: 1`** is sized for a corpus that currently has exactly one document. Raise
  as the corpus grows.
- **Citation granularity is per-document, not per-claim.** If one document is cited across several
  distinct sentences, they collapse into a single citation row with a multi-sentence `claim_text`.
  Revisit if finer-grained detail is needed for medical board review.
- **No web UI yet.** Building the actual "doctor types a question into a page" experience is
  deferred until the doctor verification queue exists and there's a real login/session to derive
  `doctorId` from.
