import { extractText, getDocumentProxy } from "unpdf";
import type { ExtractionResult } from "./types";

// Below this average chars/page, a PDF is probably scanned/image-only rather than a normal text
// layer — flag it loudly rather than silently ingesting near-empty text. No real Tier-1 sample
// docs exist yet to calibrate this precisely; revisit once real ICMR/NHM/NCDC files are available.
const LOW_YIELD_CHARS_PER_PAGE = 20;

/** Pure: no network, no filesystem — caller reads the file and passes the bytes in. */
export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  const trimmed = text.trim();
  const warnings: string[] = [];

  if (trimmed.length === 0) {
    throw new Error(
      "Extracted text is empty — this PDF is likely scanned/image-only and needs OCR " +
        "(not yet implemented) or a different source file.",
    );
  }

  const charsPerPage = trimmed.length / totalPages;
  if (charsPerPage < LOW_YIELD_CHARS_PER_PAGE) {
    warnings.push(
      `Low text yield (~${Math.round(charsPerPage)} chars/page) — possible scanned/image PDF, ` +
        "needs OCR or manual re-source.",
    );
  }

  return { text: trimmed, pageCount: totalPages, warnings };
}
