import { createAdminClient } from "@/lib/supabase/admin";
import { embedText } from "@/lib/ingestion/embed";
import { retrieveDocuments } from "./retrieve";
import { synthesizeAnswer } from "./synthesize";
import { insertQuery, completeQuery, insertCitations } from "./persist";

export interface AnswerQueryArgs {
  doctorId: string;
  queryText: string;
}

export interface AnswerQueryResult {
  queryId: string;
  responseText: string;
  responseTimeMs: number;
  citationCount: number;
}

export async function answerQuery(args: AnswerQueryArgs): Promise<AnswerQueryResult> {
  const admin = createAdminClient();
  const startedAt = Date.now();

  const { id: queryId } = await insertQuery(admin, {
    doctorId: args.doctorId,
    queryText: args.queryText,
  });

  // Not caught here: if embed/retrieve/synthesize throws, the queries row stays with
  // response_text=null — a legible "failed attempt" record, consistent with that column's
  // documented two-phase purpose.
  const queryEmbedding = await embedText(args.queryText, "query");
  const chunks = await retrieveDocuments(admin, queryEmbedding);
  console.error(
    `[query] retrieved ${chunks.length} chunk(s): ${chunks.map((c) => `${c.title} (tier ${c.tier}, distance ${c.distance.toFixed(4)})`).join(", ") || "none"}`,
  );

  let responseText: string;
  let citations: { documentId: string; chunkId: string; claimText: string }[];

  if (chunks.length === 0) {
    // Skip Claude entirely — nothing to cite, and calling the model here would only produce an
    // ambiguous zero-citation response indistinguishable from a real uncited claim.
    responseText =
      "No Tier 1 or Tier 2 sources were found with sufficient similarity to this query.";
    citations = [];
  } else {
    ({ responseText, citations } = await synthesizeAnswer(args.queryText, chunks));
  }

  const responseTimeMs = Date.now() - startedAt;
  await completeQuery(admin, queryId, { responseText, responseTimeMs });
  await insertCitations(admin, queryId, citations);

  return { queryId, responseText, responseTimeMs, citationCount: citations.length };
}
