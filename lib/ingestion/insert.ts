import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentSource, DocumentTier } from "./types";

// Takes the admin client as a parameter (not constructed internally) so this is mockable against
// a fake Supabase stub without touching a real database.
export async function insertDocument(
  admin: SupabaseClient,
  payload: {
    source: DocumentSource;
    tier: DocumentTier;
    title: string;
    raw_text: string;
    external_id?: string;
    source_url?: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("documents")
    .insert({
      source: payload.source,
      tier: payload.tier,
      title: payload.title,
      raw_text: payload.raw_text,
      external_id: payload.external_id ?? null,
      source_url: payload.source_url ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert document "${payload.title}": ${error.message}`);
  }

  return { id: data.id as string };
}

export interface ChunkInsertPayload {
  chunkIndex: number;
  chunkText: string;
  embedding: number[] | null;
}

export async function insertDocumentChunks(
  admin: SupabaseClient,
  documentId: string,
  chunks: ChunkInsertPayload[],
): Promise<void> {
  if (chunks.length === 0) return;

  const { error } = await admin.from("document_chunks").insert(
    chunks.map((c) => ({
      document_id: documentId,
      chunk_index: c.chunkIndex,
      chunk_text: c.chunkText,
      embedding: c.embedding,
    })),
  );

  if (error) {
    throw new Error(`Failed to insert chunks for document ${documentId}: ${error.message}`);
  }
}

export async function backfillChunkEmbedding(
  admin: SupabaseClient,
  chunkId: string,
  embedding: number[],
): Promise<void> {
  const { error } = await admin.from("document_chunks").update({ embedding }).eq("id", chunkId);

  if (error) {
    throw new Error(`Failed to backfill embedding for chunk ${chunkId}: ${error.message}`);
  }
}
