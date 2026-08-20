import type { RetrievedDocument, ValidationResult } from "./types";

const CITATION_MARKER_RE = /\[(\d+)\]/g;

/**
 * Mechanical validation, not prompt-trust — the concrete enforcement of "No-Citation, No-Output."
 * Guarantees every marker is well-formed and references a real retrieved document. Does NOT
 * mechanically prove every factual sentence carries a marker (that would need a real
 * claim-detector, out of scope here) — it only fails closed if the response has zero markers.
 */
export function validateCitations(
  responseText: string,
  docs: RetrievedDocument[],
): ValidationResult {
  const markers = [...responseText.matchAll(CITATION_MARKER_RE)].map((m) => Number(m[1]));

  if (markers.length === 0) {
    return { valid: false, reason: "no citation markers present" };
  }

  for (const n of markers) {
    if (n < 1 || n > docs.length) {
      return {
        valid: false,
        reason: `citation [${n}] references a document outside the retrieved set (1-${docs.length})`,
      };
    }
  }

  // Sentence-level pass: co-locate each marker with its sentence to build per-document claimText.
  const sentences = responseText.split(/(?<=[.!?])\s+/);
  const byDoc = new Map<number, string[]>();

  for (const sentence of sentences) {
    for (const m of sentence.matchAll(CITATION_MARKER_RE)) {
      const idx = Number(m[1]);
      if (!byDoc.has(idx)) byDoc.set(idx, []);
      byDoc.get(idx)!.push(sentence.trim());
    }
  }

  const citations = [...byDoc.entries()].map(([idx, docSentences]) => ({
    documentId: docs[idx - 1].id,
    claimText: docSentences.join(" "),
  }));

  return { valid: true, citations };
}
