import type { SupabaseClient } from "@supabase/supabase-js";
import type { IngestPayload } from "./types";

// Takes the admin client as a parameter (not constructed internally) so this is mockable against
// a fake Supabase stub without touching a real database.
export async function insertDocument(
  admin: SupabaseClient,
  payload: IngestPayload,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("documents")
    .insert({
      source: payload.source,
      tier: payload.tier,
      title: payload.title,
      raw_text: payload.raw_text,
      embedding: payload.embedding,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert document "${payload.title}": ${error.message}`);
  }

  return { id: data.id as string };
}

export async function backfillEmbedding(
  admin: SupabaseClient,
  id: string,
  embedding: number[],
): Promise<void> {
  const { error } = await admin.from("documents").update({ embedding }).eq("id", id);

  if (error) {
    throw new Error(`Failed to backfill embedding for document ${id}: ${error.message}`);
  }
}
