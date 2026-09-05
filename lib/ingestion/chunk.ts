// Paragraph-aware chunking: splits on blank-line boundaries so a chunk boundary almost never
// lands mid-sentence, then greedily packs paragraphs up to CHUNK_CHAR_BUDGET. A fixed overlap is
// carried into the start of each new chunk so a claim/finding stated right at a chunk boundary
// still has some surrounding context on both sides, rather than being split with zero shared text.
//
// Each output chunk also carries page_start/page_end (the range of source pages its text was
// drawn from — null when the source has no page concept, e.g. PMC full text) and section (a
// best-effort label for where in the document the chunk begins — see ExtractedParagraph's own
// doc comment for why this is never guessed for PDF-derived text).

import type { ExtractedParagraph } from "./types";

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

export interface Chunk {
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
}

// A piece of text folded into the chunk currently being built — either a real paragraph, or a
// carried-over overlap tail from the previous chunk (see below). Both are tagged with page/section
// the same way, since the tail is literally a continuation of the paragraph it was sliced from.
interface Piece {
  text: string;
  page: number | null;
  section: string | null;
}

function pagesOf(pieces: Piece[]): { pageStart: number | null; pageEnd: number | null } {
  const pages = pieces.map((p) => p.page).filter((p): p is number => p !== null);
  if (pages.length === 0) return { pageStart: null, pageEnd: null };
  return { pageStart: Math.min(...pages), pageEnd: Math.max(...pages) };
}

function hardSplitText(text: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHAR_BUDGET, text.length);
    pieces.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return pieces;
}

/**
 * Known, accepted edge case: after a hard-split fallback (a single paragraph exceeding
 * CHUNK_CHAR_BUDGET, e.g. OCR output with no real paragraph breaks), the *next* normal paragraph
 * starts a fresh chunk with no overlap carried in from the last hard-split piece — only
 * paragraph-to-paragraph transitions get overlap. This only matters for documents with an
 * oversized paragraph immediately followed by normal paragraphs — rare, and not worth the added
 * complexity of threading overlap across two different splitting strategies.
 */
export function chunkParagraphs(paragraphs: ExtractedParagraph[]): Chunk[] {
  const chunks: Chunk[] = [];
  let currentText = "";
  let currentPieces: Piece[] = [];

  const flush = () => {
    if (currentText.trim().length === 0) return;
    chunks.push({
      text: currentText.trim(),
      // The chunk's location is wherever its text *begins* — the first piece folded in, whether
      // that's a real paragraph or a carried-over tail — not "any non-null page/section found
      // anywhere in the chunk," which could point past a section boundary the chunk itself spans.
      section: currentPieces[0]?.section ?? null,
      ...pagesOf(currentPieces),
    });
  };

  const reset = () => {
    currentText = "";
    currentPieces = [];
  };

  const push = (piece: Piece) => {
    currentText = currentText.length === 0 ? piece.text : `${currentText}\n\n${piece.text}`;
    currentPieces.push(piece);
  };

  for (const paragraph of paragraphs) {
    if (paragraph.text.length > CHUNK_CHAR_BUDGET) {
      flush();
      reset();
      // Forcibly split, but every resulting piece is still the same original paragraph, so it all
      // shares that paragraph's page/section — there's no finer-grained location to attribute
      // within a single run-on paragraph.
      for (const pieceText of hardSplitText(paragraph.text)) {
        chunks.push({
          text: pieceText,
          pageStart: paragraph.page,
          pageEnd: paragraph.page,
          section: paragraph.section,
        });
      }
      continue;
    }

    const joinedLength =
      currentText.length === 0 ? paragraph.text.length : currentText.length + 2 + paragraph.text.length;

    if (joinedLength <= CHUNK_CHAR_BUDGET) {
      push({ text: paragraph.text, page: paragraph.page, section: paragraph.section });
    } else {
      flush();
      const lastPiece = currentPieces[currentPieces.length - 1] ?? null;
      const tailText =
        currentText.length > CHUNK_OVERLAP_CHARS ? currentText.slice(-CHUNK_OVERLAP_CHARS) : currentText;
      reset();
      if (tailText && lastPiece) {
        push({ text: tailText, page: lastPiece.page, section: lastPiece.section });
      }
      push({ text: paragraph.text, page: paragraph.page, section: paragraph.section });
    }
  }

  flush();
  return chunks;
}
