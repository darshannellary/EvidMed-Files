export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  source: string;
  tier: 1 | 2;
  title: string;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
  distance: number;
}

export interface ValidCitationResult {
  valid: true;
  citations: { documentId: string; chunkId: string; claimText: string }[];
}

export interface InvalidCitationResult {
  valid: false;
  reason: string;
}

export type ValidationResult = ValidCitationResult | InvalidCitationResult;

export interface SynthesisResult {
  responseText: string;
  citations: { documentId: string; chunkId: string; claimText: string }[];
}

export interface CitedSource {
  documentId: string;
  chunkId: string;
  title: string;
  source: string;
  tier: 1 | 2;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
}
