const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-large";
const VOYAGE_DIMENSIONS = 1024;

export class VoyageEmbeddingError extends Error {}

interface VoyageEmbeddingsResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * Impure: makes a real network call. This is the one step that can't be exercised without a real
 * VOYAGE_API_KEY — the response shape assumed here is unverified until then.
 *
 * `inputType` matches Voyage's asymmetric-retrieval convention: ingested documents use
 * "document", queries use "query". Untested whether the two are actually comparable for this
 * product's data until run against a real corpus.
 */
export async function embedText(
  text: string,
  inputType: "query" | "document" = "document",
): Promise<number[]> {
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
      input: [text],
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
  const embedding = json.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== VOYAGE_DIMENSIONS) {
    throw new VoyageEmbeddingError(
      `Unexpected Voyage response shape: expected a ${VOYAGE_DIMENSIONS}-dim embedding, got ${JSON.stringify(json).slice(0, 200)}`,
    );
  }

  return embedding;
}
