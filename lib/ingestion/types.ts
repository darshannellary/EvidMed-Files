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

export interface ExtractionResult {
  text: string;
  pageCount: number;
  warnings: string[];
}
