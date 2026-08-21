import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedChunk } from "./types";

const TIER1_MATCH_COUNT = 5;
const TIER2_MATCH_COUNT = 5;
// Total chunks sent to Claude — keeps the prompt small for the <10s response target.
const MAX_CONTEXT_CHUNKS = 8;
// Cosine distance threshold. Calibrated from one real data point, measured against a
// whole-document embedding before chunking existed: a genuinely relevant query-vs-document match
// (the question was literally "what does this document say") measured 0.5451. 0.75 gives that
// real match comfortable margin while still excluding the "opposite direction" end of the
// distance range (max possible is 2.0). Post-chunking, a chunk-level embedding represents a much
// narrower slice of content than the old whole-document average, so genuine matches should
// cluster measurably closer to 0 than that single data point — worth re-verifying once real
// chunked data exists, not assumed to still be the right number.
const MAX_DISTANCE = 0.75;
// Post-chunking, even one ingested document produces many chunks, so this is no longer "raise
// this once the corpus has more than one document" — the real justification is just the
// still-small/early corpus overall. Raise as more documents are ingested.
const MIN_TIER1_RESULTS = 1;

async function callMatchDocumentChunks(
  admin: SupabaseClient,
  queryEmbedding: number[],
  tier: 1 | 2,
  matchCount: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await admin.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_tier: tier,
    match_count: matchCount,
    max_distance: MAX_DISTANCE,
  });

  if (error) {
    throw new Error(`match_document_chunks RPC failed (tier ${tier}): ${error.message}`);
  }

  return (data ?? []) as RetrievedChunk[];
}

/**
 * Tier-1-then-Tier-2 retrieval: Tier 1 is always checked first, and Tier 2 is only queried (and
 * therefore only ever surfaced) if Tier 1 doesn't return enough results. This is the concrete
 * enforcement of the product's "India-grounded first" principle.
 *
 * Multiple chunks from the same parent document can now legitimately both appear in one result
 * set — structurally impossible before chunking (one row, one embedding, per whole document).
 * This is the direct mechanism by which chunking improves retrieval and citation precision: two
 * different sections of the same guideline, each relevant to a different facet of a query, can
 * now both surface and both get cited independently (see lib/rag/validate.ts).
 */
export async function retrieveDocuments(
  admin: SupabaseClient,
  queryEmbedding: number[],
): Promise<RetrievedChunk[]> {
  const tier1 = await callMatchDocumentChunks(admin, queryEmbedding, 1, TIER1_MATCH_COUNT);
  if (tier1.length >= MIN_TIER1_RESULTS) {
    return tier1;
  }

  const remaining = MAX_CONTEXT_CHUNKS - tier1.length;
  const tier2 =
    remaining > 0
      ? await callMatchDocumentChunks(admin, queryEmbedding, 2, Math.min(TIER2_MATCH_COUNT, remaining))
      : [];

  // Tier 1 chunks always ordered first, even when Tier 2 is appended — preserves prioritization
  // and keeps citation-marker array positions correct in lib/rag/synthesize.ts.
  return [...tier1, ...tier2];
}
