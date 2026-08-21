// Paragraph-aware chunking: splits on blank-line boundaries so a chunk boundary almost never
// lands mid-sentence, then greedily packs paragraphs up to CHUNK_CHAR_BUDGET. A fixed overlap is
// carried into the start of each new chunk so a claim/finding stated right at a chunk boundary
// still has some surrounding context on both sides, rather than being split with zero shared text.

// Matches synthesize.ts's existing CHUNK_EXCERPT_CHAR_BUDGET (4000) by design: that constant was
// already the de facto "how much of one source gets sent to Claude" budget even before chunking
// existed (whole documents were truncated to 4000 chars in the prompt). Keeping chunk size equal
// to that budget means a chunk's full text now fits the prompt without a second truncation step.
export const CHUNK_CHAR_BUDGET = 4000;

// ~10% of CHUNK_CHAR_BUDGET. Paragraph-aware splitting is the primary defense against cutting a
// claim across a boundary with no context; overlap is a secondary safety net for the (more common)
// case where a claim spans multiple sentences right at a paragraph boundary. 10% is enough to
// carry a full sentence or two of trailing context without meaningfully inflating embedding/token
// cost (a document with N chunks pays ~10% extra embedded text, not 2x).
export const CHUNK_OVERLAP_CHARS = 400;

/**
 * Known, accepted edge case: after a hard-split fallback (a single paragraph exceeding
 * CHUNK_CHAR_BUDGET, e.g. OCR output with no real paragraph breaks), the *next* normal paragraph
 * starts a fresh chunk with no overlap carried in from the last hard-split piece — only
 * paragraph-to-paragraph transitions get overlap. This only matters for documents with an
 * oversized paragraph immediately followed by normal paragraphs — rare, and not worth the added
 * complexity of threading overlap across two different splitting strategies.
 */
export function chunkText(text: string): string[] {
  const normalized = text.trim();
  if (normalized.length === 0) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim().length > 0) chunks.push(current.trim());
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_CHAR_BUDGET) {
      flush();
      current = "";
      chunks.push(...hardSplit(paragraph));
      continue;
    }

    const joinedLength =
      current.length === 0 ? paragraph.length : current.length + 2 + paragraph.length;

    if (joinedLength <= CHUNK_CHAR_BUDGET) {
      current = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    } else {
      flush();
      const tail = current.length > CHUNK_OVERLAP_CHARS ? current.slice(-CHUNK_OVERLAP_CHARS) : current;
      current = tail ? `${tail}\n\n${paragraph}` : paragraph;
    }
  }

  flush();
  return chunks;
}

function hardSplit(paragraph: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < paragraph.length) {
    const end = Math.min(start + CHUNK_CHAR_BUDGET, paragraph.length);
    pieces.push(paragraph.slice(start, end));
    if (end === paragraph.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return pieces;
}
