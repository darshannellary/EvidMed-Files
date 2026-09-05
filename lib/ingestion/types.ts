export type DocumentSource =
  | "ICMR"
  | "NHM"
  | "NCDC"
  | "EssentialMedicinesList"
  | "PubMedCentral"
  | "Cochrane"
  | "medRxiv";

export type DocumentTier = 1 | 2;

// Mirrors the DB check constraint (supabase/migrations/20260818090000_core_schema.sql) so a bad
// --source/--tier pairing is rejected before spending a Voyage API call.
export const SOURCE_TIER_MAP: Record<DocumentSource, DocumentTier> = {
  ICMR: 1,
  NHM: 1,
  NCDC: 1,
  EssentialMedicinesList: 1,
  PubMedCentral: 2,
  Cochrane: 2,
  medRxiv: 2,
};

export function isDocumentSource(value: string): value is DocumentSource {
  return value in SOURCE_TIER_MAP;
}

export function assertSourceTierMatch(source: DocumentSource, tier: DocumentTier): void {
  const expectedTier = SOURCE_TIER_MAP[source];
  if (expectedTier !== tier) {
    throw new Error(
      `Source "${source}" is Tier ${expectedTier}, but --tier=${tier} was given.`,
    );
  }
}

/**
 * The unit chunking operates on. `page` is the 1-based PDF page the paragraph came from, or null
 * when the source has no page concept at all (PMC BioC full text is a flat passage stream, not a
 * paginated document). `section` is a best-effort structural label — populated only where it's
 * derived from real structure (PMC's BioC `section_type`, see lib/ingestion/pubmed.ts), never
 * guessed from prose heuristics. A PDF-derived paragraph always has section: null — plain
 * extracted PDF text carries no reliable heading markup to detect a section from, and a wrong
 * guess would misrepresent where a claim sits in a clinical guideline, which is worse than no
 * label at all.
 */
export interface ExtractedParagraph {
  text: string;
  page: number | null;
  section: string | null;
}

export interface ExtractionResult {
  paragraphs: ExtractedParagraph[];
  pageCount: number | null;
  warnings: string[];
}
