# Document Ingestion Pipeline

Extracts text from a Tier-1/Tier-2 PDF, embeds it via Voyage AI (`voyage-3-large`, 1024 dims), and
inserts it into the `documents` table using the service-role admin client (RLS has no
anon/authenticated write policies, so this is the only write path — see
`supabase/migrations/20260818090100_enable_rls.sql`).

## Usage

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

If the Voyage embedding call fails, the document is still inserted with `raw_text` populated and
`embedding: null` (two-phase fallback). Run the backfill afterward to fill in any missing
embeddings once Voyage is reachable:

```bash
npm run ingest:backfill-embeddings
```

## Known gaps

- **No OCR.** If a PDF is scanned/image-only, extraction fails loudly (empty text) or warns loudly
  (low text yield per page) rather than silently ingesting garbage. Whether real ICMR/NHM/NCDC PDFs
  need OCR is unknown until real sample documents are tested — build note in the tech spec calls
  this "the most tedious, least AI-magic part of the build."
- **No chunking.** `documents.raw_text` is a single column; long documents are truncated (not
  dropped) before embedding only, since Voyage has a finite context window. Revisit with a proper
  chunking table once real document lengths are known.
