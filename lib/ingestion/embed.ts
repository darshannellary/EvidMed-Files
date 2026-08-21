const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;

export class VoyageEmbeddingError extends Error {}

interface VoyageEmbeddingsResponse {
  data: Array<{ embedding: number[]; index?: number }>;
}

/**
 * Impure: makes a real network call. This is the one step that can't be exercised without a real
 * VOYAGE_API_KEY — the response shape assumed here is unverified until then.
 *
 * `inputType` matches Voyage's asymmetric-retrieval convention: ingested documents use
 * "document", queries use "query". Untested whether the two are actually comparable for this
 * product's data until run against a real corpus.
 *
 * Accepts multiple texts per call (Voyage's endpoint already accepts an array input — a single
 * embedText() call previously just always sent an array of exactly 1). Batching lets ingestion
 * embed many chunks of one document in a handful of API calls instead of one per chunk.
 */
export async function embedTexts(
  texts: string[],
  inputType: "query" | "document" = "document",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new VoyageEmbeddingError("VOYAGE_API_KEY is not set");
  }

  const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: VOYAGE_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new VoyageEmbeddingError(
      `Voyage API request failed: ${response.status} ${response.statusText} — ${body}`,
    );
  }

  const json = (await response.json()) as VoyageEmbeddingsResponse;
  const rows = json.data ?? [];

  if (rows.length !== texts.length) {
    throw new VoyageEmbeddingError(
      `Expected ${texts.length} embeddings, got ${rows.length}: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }

  // Defensive: sort by each row's `index` field (mapping back to input position) rather than
  // trusting response order, since nothing in this codebase has verified that ordering against a
  // real API response yet.
  const ordered = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  return ordered.map((row, i) => {
    if (!Array.isArray(row.embedding) || row.embedding.length !== VOYAGE_DIMENSIONS) {
      throw new VoyageEmbeddingError(
        `Unexpected embedding shape at index ${i}: expected ${VOYAGE_DIMENSIONS} dims`,
      );
    }
    return row.embedding;
  });
}

export async function embedText(
  text: string,
  inputType: "query" | "document" = "document",
): Promise<number[]> {
  const [embedding] = await embedTexts([text], inputType);
  return embedding;
}
