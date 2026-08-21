import type { RetrievedChunk, ValidationResult } from "./types";

const CITATION_MARKER_RE = /\[(\d+)\]/g;

// Claude is instructed (see synthesize.ts's SYSTEM_PROMPT) to emit exactly this string, and
// nothing else, when the retrieved sources genuinely don't address the question. This is the
// machine-checkable escape hatch for a *legitimate* zero-citation response — distinct from an
// uncited claim, which is still rejected below. Without this, "the sources don't answer this"
// (a correct, honest answer) would be indistinguishable from a hallucinated uncited claim and
// would incorrectly fail validation every time.
export const NO_ANSWER_SENTINEL = "NO_RELEVANT_SOURCES";

/**
 * Mechanical validation, not prompt-trust — the concrete enforcement of "No-Citation, No-Output."
 * Guarantees every marker is well-formed and references a real retrieved chunk. Does NOT
 * mechanically prove every factual sentence carries a marker (that would need a real
 * claim-detector, out of scope here) — it only fails closed if the response has zero markers,
 * unless the response is the explicit NO_ANSWER_SENTINEL.
 *
 * Citation granularity is per-chunk, not per-document: the aggregation key here has always been
 * "the citation marker's array index" — the only reason this used to collapse to per-document was
 * that the array previously held one row per whole document. Now that the array holds one row per
 * chunk, two different chunks of the same document, cited in two different sentences, correctly
 * produce two separate citation rows (same documentId, different chunkId, own claimText) instead
 * of collapsing into one row with both sentences concatenated. Residual, still-accepted coarseness:
 * the *same* chunk cited across two non-contiguous sentences still collapses to one row
 * (aggregation key is chunk index, not sentence index).
 */
export function validateCitations(
  responseText: string,
  chunks: RetrievedChunk[],
): ValidationResult {
  if (responseText.trim() === NO_ANSWER_SENTINEL) {
    return { valid: true, citations: [] };
  }

  const markers = [...responseText.matchAll(CITATION_MARKER_RE)].map((m) => Number(m[1]));

  if (markers.length === 0) {
    return { valid: false, reason: "no citation markers present" };
  }

  for (const n of markers) {
    if (n < 1 || n > chunks.length) {
      return {
        valid: false,
        reason: `citation [${n}] references a source outside the retrieved set (1-${chunks.length})`,
      };
    }
  }

  // Sentence-level pass: co-locate each marker with its sentence to build per-chunk claimText.
  const sentences = responseText.split(/(?<=[.!?])\s+/);
  const byChunk = new Map<number, string[]>();

  for (const sentence of sentences) {
    for (const m of sentence.matchAll(CITATION_MARKER_RE)) {
      const idx = Number(m[1]);
      if (!byChunk.has(idx)) byChunk.set(idx, []);
      byChunk.get(idx)!.push(sentence.trim());
    }
  }

  const citations = [...byChunk.entries()].map(([idx, chunkSentences]) => {
    const chunk = chunks[idx - 1];
    return {
      documentId: chunk.document_id,
      chunkId: chunk.chunk_id,
      claimText: chunkSentences.join(" "),
    };
  });

  return { valid: true, citations };
}
