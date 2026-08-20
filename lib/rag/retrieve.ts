import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedDocument } from "./types";

const TIER1_MATCH_COUNT = 5;
const TIER2_MATCH_COUNT = 5;
// Total sent to Claude — keeps the prompt small for the <10s response target.
const MAX_CONTEXT_DOCS = 8;
// Cosine distance threshold. Calibrated from one real data point: a genuinely relevant
// query-vs-document match (the question was literally "what does this document say") measured
// 0.5451. 0.75 gives that real match comfortable margin while still excluding the "opposite
// direction" end of the distance range (max possible is 2.0). This is still a rough calibration
// from a single true-positive, with no observed true-negative yet (the corpus has one document) —
// revisit once more documents and more varied real queries exist.
const MAX_DISTANCE = 0.75;
// With exactly one document in the whole corpus today, a higher threshold could never be
// satisfied. Raise as the corpus grows.
const MIN_TIER1_RESULTS = 1;

async function callMatchDocuments(
  admin: SupabaseClient,
  queryEmbedding: number[],
  tier: 1 | 2,
  matchCount: number,
): Promise<RetrievedDocument[]> {
  const { data, error } = await admin.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_tier: tier,
    match_count: matchCount,
    max_distance: MAX_DISTANCE,
  });

  if (error) {
    throw new Error(`match_documents RPC failed (tier ${tier}): ${error.message}`);
  }

  return (data ?? []) as RetrievedDocument[];
}

/**
 * Tier-1-then-Tier-2 retrieval: Tier 1 is always checked first, and Tier 2 is only queried (and
 * therefore only ever surfaced) if Tier 1 doesn't return enough results. This is the concrete
 * enforcement of the product's "India-grounded first" principle.
 */
export async function retrieveDocuments(
  admin: SupabaseClient,
  queryEmbedding: number[],
): Promise<RetrievedDocument[]> {
  const tier1 = await callMatchDocuments(admin, queryEmbedding, 1, TIER1_MATCH_COUNT);
  if (tier1.length >= MIN_TIER1_RESULTS) {
    return tier1;
  }

  const remaining = MAX_CONTEXT_DOCS - tier1.length;
  const tier2 =
    remaining > 0
      ? await callMatchDocuments(admin, queryEmbedding, 2, Math.min(TIER2_MATCH_COUNT, remaining))
      : [];

  // Tier 1 docs always ordered first, even when Tier 2 is appended — preserves prioritization
  // and keeps citation-marker array positions correct in lib/rag/synthesize.ts.
  return [...tier1, ...tier2];
}
