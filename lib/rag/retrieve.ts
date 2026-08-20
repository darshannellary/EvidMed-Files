import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedDocument } from "./types";

const TIER1_MATCH_COUNT = 5;
const TIER2_MATCH_COUNT = 5;
// Total sent to Claude — keeps the prompt small for the <10s response target.
const MAX_CONTEXT_DOCS = 8;
// Cosine distance threshold. TEMPORARILY widened to 2.0 (the maximum possible cosine distance)
// to measure the real query-vs-document distance via the [query] retrieved ... diagnostic log in
// pipeline.ts — 0.4 was an unverified guess that turned out to reject every real result. Tighten
// back down once we have a real number to calibrate against.
const MAX_DISTANCE = 2.0;
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
