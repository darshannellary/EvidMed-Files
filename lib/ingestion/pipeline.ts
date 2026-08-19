import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromPdf } from "./extract";
import { embedText } from "./embed";
import { insertDocument, backfillEmbedding } from "./insert";
import { assertSourceTierMatch, type DocumentSource, type DocumentTier } from "./types";

// voyage-3-large's context window is ~32K tokens; truncate conservatively before embedding only
// (the full text is still stored). No chunking table exists yet — that's a schema change, out of
// scope here. Revisit once real document lengths are known.
const EMBEDDING_CHAR_BUDGET = 100_000;

export interface IngestDocumentArgs {
  filePath: string;
  source: DocumentSource;
  tier: DocumentTier;
  title: string;
}

export async function ingestDocument(args: IngestDocumentArgs): Promise<{ id: string }> {
  const { filePath, source, tier, title } = args;

  assertSourceTierMatch(source, tier);

  const buffer = await readFile(filePath);
  const { text, warnings } = await extractTextFromPdf(buffer);
  for (const warning of warnings) {
    console.warn(`[ingest] ${filePath}: ${warning}`);
  }

  let embeddingInput = text;
  if (embeddingInput.length > EMBEDDING_CHAR_BUDGET) {
    console.warn(
      `[ingest] ${filePath}: truncating ${embeddingInput.length} chars to ${EMBEDDING_CHAR_BUDGET} for embedding (full text still stored)`,
    );
    embeddingInput = embeddingInput.slice(0, EMBEDDING_CHAR_BUDGET);
  }

  const admin = createAdminClient();

  let embedding: number[] | null = null;
  try {
    embedding = await embedText(embeddingInput);
  } catch (err) {
    // Two-phase fallback: store the text now, backfill the embedding later via
    // backfillEmbeddings(). This is the exact path documents.embedding being nullable was built for.
    console.error(
      `[ingest] ${filePath}: embedding failed, inserting with embedding=null: ${(err as Error).message}`,
    );
  }

  return insertDocument(admin, { source, tier, title, raw_text: text, embedding });
}

export async function backfillEmbeddings(admin: SupabaseClient = createAdminClient()) {
  const { data, error } = await admin
    .from("documents")
    .select("id, raw_text")
    .is("embedding", null);

  if (error) {
    throw new Error(`Failed to query documents needing backfill: ${error.message}`);
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of data ?? []) {
    if (!row.raw_text) continue;
    try {
      const embedding = await embedText(row.raw_text.slice(0, EMBEDDING_CHAR_BUDGET));
      await backfillEmbedding(admin, row.id, embedding);
      succeeded++;
    } catch (err) {
      console.error(`[backfill] document ${row.id}: ${(err as Error).message}`);
      failed++;
    }
  }

  return { succeeded, failed };
}
