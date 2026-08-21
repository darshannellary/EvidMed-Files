import type { SupabaseClient } from "@supabase/supabase-js";

// Admin-client-as-parameter throughout, mirroring lib/ingestion/insert.ts, so this is mockable
// against a fake Supabase stub without touching a real database.

export async function insertQuery(
  admin: SupabaseClient,
  args: { doctorId: string; queryText: string },
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("queries")
    .insert({ doctor_id: args.doctorId, query_text: args.queryText })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert query: ${error.message}`);
  }

  return { id: data.id as string };
}

export async function completeQuery(
  admin: SupabaseClient,
  queryId: string,
  args: { responseText: string; responseTimeMs: number },
): Promise<void> {
  const { error } = await admin
    .from("queries")
    .update({ response_text: args.responseText, response_time_ms: args.responseTimeMs })
    .eq("id", queryId);

  if (error) {
    throw new Error(`Failed to complete query ${queryId}: ${error.message}`);
  }
}

export async function insertCitations(
  admin: SupabaseClient,
  queryId: string,
  citations: { documentId: string; chunkId: string; claimText: string }[],
): Promise<void> {
  if (citations.length === 0) return;

  const { error } = await admin.from("citations").insert(
    citations.map((c) => ({
      query_id: queryId,
      document_id: c.documentId,
      chunk_id: c.chunkId,
      claim_text: c.claimText,
    })),
  );

  if (error) {
    throw new Error(`Failed to insert citations for query ${queryId}: ${error.message}`);
  }
}
