import { extractText, getDocumentProxy } from "unpdf";
import type { ExtractedParagraph, ExtractionResult } from "./types";

// Below this average chars/page, a PDF is probably scanned/image-only rather than a normal text
// layer — flag it loudly rather than silently ingesting near-empty text. No real Tier-1 sample
// docs exist yet to calibrate this precisely; revisit once real ICMR/NHM/NCDC files are available.
const LOW_YIELD_CHARS_PER_PAGE = 20;

/**
 * unpdf's own mergePages:true path (normalizeMergedText) collapses whitespace runs and excess
 * blank lines across the whole merged string. Extracting per-page instead (mergePages:false) means
 * that normalization has to happen per page here, since unpdf only applies it in the merged path.
 */
function normalizePageText(raw: string): string {
  return raw
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits one page's normalized text into paragraphs on blank-line boundaries, tagged with the
 * page they came from. A paragraph that actually continues across a page break (no blank line at
 * the break, just a page boundary) still gets split here into two page-tagged paragraphs — a
 * known, accepted edge case: lib/ingestion/chunk.ts's greedy packing recombines adjacent
 * paragraphs up to its char budget regardless, so this only affects paragraph granularity at page
 * boundaries, never a chunk's resulting page_start/page_end range.
 */
function paragraphsForPage(pageText: string, pageNumber: number): ExtractedParagraph[] {
  return pageText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((text) => ({ text, page: pageNumber, section: null }));
}

/** Pure: no network, no filesystem — caller reads the file and passes the bytes in. */
export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text: pageTexts } = await extractText(pdf, { mergePages: false });

  const paragraphs: ExtractedParagraph[] = [];
  let totalChars = 0;
  for (let i = 0; i < pageTexts.length; i++) {
    const normalized = normalizePageText(pageTexts[i]);
    totalChars += normalized.length;
    paragraphs.push(...paragraphsForPage(normalized, i + 1));
  }

  const warnings: string[] = [];

  if (totalChars === 0) {
    throw new Error(
      "Extracted text is empty — this PDF is likely scanned/image-only and needs OCR " +
        "(not yet implemented) or a different source file.",
    );
  }

  const charsPerPage = totalChars / totalPages;
  if (charsPerPage < LOW_YIELD_CHARS_PER_PAGE) {
    warnings.push(
      `Low text yield (~${Math.round(charsPerPage)} chars/page) — possible scanned/image PDF, ` +
        "needs OCR or manual re-source.",
    );
  }

  return { paragraphs, pageCount: totalPages, warnings };
}
