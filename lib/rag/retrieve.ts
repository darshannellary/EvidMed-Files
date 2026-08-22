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
 * Both tiers are always queried (budget permitting) — a Tier-1 match is no longer treated as
 * sufficient reason to skip Tier 2, regardless of whether that Tier-1 match is actually relevant
 * to the question. A prior version returned early on any Tier-1 result, which meant a single
 * barely-closer-than-irrelevant Tier-1 chunk (e.g. cosine distance 0.6026, just inside
 * MAX_DISTANCE) could silently block a genuinely relevant Tier-2 source from ever being
 * considered — with only 2 data points calibrating MAX_DISTANCE, there's no safe global cutoff
 * that reliably separates "relevant" from "merely closest available."
 *
 * "India-grounded first" is now enforced at synthesis time instead: Tier 1 chunks are still
 * ordered first in the returned array, and lib/rag/synthesize.ts's system prompt explicitly
 * instructs Claude to prefer them when both tiers genuinely address the question. Claude's own
 * judgment of relevance at answer time is a better gate than a blind retrieval-time distance
 * threshold — this fixes the false-negative case (irrelevant Tier 1 blocking real Tier 2 content)
 * without needing a fragile, still-just-as-fragile-with-2-data-points MAX_DISTANCE recalibration.
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

  const remaining = MAX_CONTEXT_CHUNKS - tier1.length;
  const tier2 =
    remaining > 0
      ? await callMatchDocumentChunks(admin, queryEmbedding, 2, Math.min(TIER2_MATCH_COUNT, remaining))
      : [];

  // Tier 1 chunks always ordered first, even though Tier 2 is now always queried too — preserves
  // prioritization and keeps citation-marker array positions correct in lib/rag/synthesize.ts.
  return [...tier1, ...tier2];
}
