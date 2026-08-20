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
  const docs = await retrieveDocuments(admin, queryEmbedding);
  const { responseText, citations } = await synthesizeAnswer(args.queryText, docs);

  const responseTimeMs = Date.now() - startedAt;
  await completeQuery(admin, queryId, { responseText, responseTimeMs });
  await insertCitations(admin, queryId, citations);

  return { queryId, responseText, responseTimeMs, citationCount: citations.length };
}
