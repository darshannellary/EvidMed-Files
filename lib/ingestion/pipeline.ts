import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromPdf } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import {
  insertDocument,
  insertDocumentChunks,
  backfillChunkEmbedding,
  type ChunkInsertPayload,
} from "./insert";
import { assertSourceTierMatch, type DocumentSource, type DocumentTier } from "./types";

// Embedding batch size for Voyage calls — a placeholder, not verified against Voyage's actual
// current per-request text-array/token limits (no live network access to check from this
// sandbox). Sanity-check before ingesting an unusually large document. Batching (rather than one
// call per chunk, or one call for the whole document) balances latency/API-call count against
// blast radius: a failed batch only nulls out ~32 chunks, not potentially hundreds, and
// backfillEmbeddings() has less to redo.
const EMBED_BATCH_SIZE = 32;

export interface IngestDocumentArgs {
  filePath: string;
  source: DocumentSource;
  tier: DocumentTier;
  title: string;
}

export async function ingestDocument(
  args: IngestDocumentArgs,
): Promise<{ id: string; chunkCount: number }> {
  const { filePath, source, tier, title } = args;

  assertSourceTierMatch(source, tier);

  const buffer = await readFile(filePath);
  const { text, warnings } = await extractTextFromPdf(buffer);
  for (const warning of warnings) {
    console.warn(`[ingest] ${filePath}: ${warning}`);
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error(`${filePath}: chunking produced zero chunks from extracted text`);
  }
  if (chunks.length > 200) {
    console.warn(`[ingest] ${filePath}: ${chunks.length} chunks — unusually large document`);
  }

  const admin = createAdminClient();
  const { id: documentId } = await insertDocument(admin, { source, tier, title, raw_text: text });

  const payloads: ChunkInsertPayload[] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    try {
      const embeddings = await embedTexts(batch, "document");
      batch.forEach((t, j) =>
        payloads.push({ chunkIndex: i + j, chunkText: t, embedding: embeddings[j] }),
      );
    } catch (err) {
      // Two-phase fallback: store the chunks now, backfill embeddings later via
      // backfillEmbeddings(). Scoped to this batch, not the whole document, so a transient
      // failure only nulls out ~EMBED_BATCH_SIZE chunks.
      console.error(
        `[ingest] ${filePath}: embedding batch [${i}-${i + batch.length}) failed, inserting with embedding=null: ${(err as Error).message}`,
      );
      batch.forEach((t, j) => payloads.push({ chunkIndex: i + j, chunkText: t, embedding: null }));
    }
  }

  await insertDocumentChunks(admin, documentId, payloads);
  return { id: documentId, chunkCount: payloads.length };
}

export async function backfillEmbeddings(admin: SupabaseClient = createAdminClient()) {
  const { data, error } = await admin
    .from("document_chunks")
    .select("id, chunk_text")
    .is("embedding", null);

  if (error) {
    throw new Error(`Failed to query chunks needing backfill: ${error.message}`);
  }

  let succeeded = 0;
  let failed = 0;
  const rows = data ?? [];

  for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
    const batch = rows.slice(i, i + EMBED_BATCH_SIZE);
    let embeddings: number[][];
    try {
      embeddings = await embedTexts(
        batch.map((r) => r.chunk_text as string),
        "document",
      );
    } catch (err) {
      console.error(
        `[backfill] embedding batch starting at chunk ${batch[0]?.id}: ${(err as Error).message}`,
      );
      failed += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      try {
        await backfillChunkEmbedding(admin, batch[j].id as string, embeddings[j]);
        succeeded++;
      } catch (err) {
        console.error(`[backfill] chunk ${batch[j].id}: ${(err as Error).message}`);
        failed++;
      }
    }
  }

  return { succeeded, failed };
}
