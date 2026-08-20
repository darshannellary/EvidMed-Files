export interface RetrievedDocument {
  id: string;
  source: string;
  tier: 1 | 2;
  title: string;
  raw_text: string;
  distance: number;
}

export interface ValidCitationResult {
  valid: true;
  citations: { documentId: string; claimText: string }[];
}

export interface InvalidCitationResult {
  valid: false;
  reason: string;
}

export type ValidationResult = ValidCitationResult | InvalidCitationResult;

export interface SynthesisResult {
  responseText: string;
  citations: { documentId: string; claimText: string }[];
}
