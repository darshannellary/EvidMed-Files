import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk, SynthesisResult } from "./types";
import { validateCitations, NO_ANSWER_SENTINEL } from "./validate";

const CLAUDE_MODEL = "claude-sonnet-5";
// Per-chunk excerpt budget for the prompt — a latency/context budget distinct from ingestion's
// chunking budget (lib/ingestion/chunk.ts's CHUNK_CHAR_BUDGET, also 4000, by design — a chunk's
// full text now fits here with no second truncation in the normal case). Still a useful defensive
// cap: the hard-split chunking fallback can produce a chunk slightly over 4000 chars.
const CHUNK_EXCERPT_CHAR_BUDGET = 4000;

export class NoCitationError extends Error {}

const SYSTEM_PROMPT = `You are EvidMed AI, a research-synthesis assistant for verified Indian doctors. You inform clinical research — you never diagnose, prescribe, or issue treatment directives.

Rules, no exceptions:
1. Descriptive, not directive. Phrase findings as "guidelines indicate...", "evidence suggests...", "the cited source recommends...". Never as an instruction to the doctor: do NOT write "administer X", "you should prescribe Y", "the patient must receive Z".
2. Every factual or clinical claim must end with one or more citation markers like [1] or [2][3], referencing the numbered sources below. No exceptions — an uncited claim is not allowed.
3. Only cite sources that are actually provided below. Never invent a citation number outside the provided list.
4. If the provided sources don't address the question — including if no sources are listed at all — respond with EXACTLY this text and nothing else: ${NO_ANSWER_SENTINEL}
   Do not explain, apologize, or add anything else around it. Do not use this if you can answer using the sources.
5. Plain prose only. Put citation markers inline, mid-sentence or at sentence end. Do not add a separate "References" section.
6. Sources are labeled by tier: Tier 1 is Indian guidance (ICMR/NHM/NCDC/Essential Medicines List), Tier 2 is global literature (PubMed/PMC, Cochrane, medRxiv). When both tiers genuinely address the question, prefer and lead with Tier 1 sources — this is an Indian clinical context. Use Tier 2 only when it adds something Tier 1 doesn't cover, or when no Tier 1 source addresses the question at all. Judge relevance yourself: a Tier 1 source that doesn't actually address the question is not "coverage" — do not cite it just because it's Tier 1, and do not let its presence stop you from citing a genuinely relevant Tier 2 source.`;

/**
 * When multiple retrieved chunks share the same document, labels them "(excerpt N of M)" — N/M
 * are the chunk's position within THIS retrieval's result set, not its true chunk_index or the
 * document's total chunk count (neither is available without an extra query, and neither is what
 * the doctor needs to know). Deliberately not chunk_index ("part 7"): retrieved chunks aren't
 * necessarily contiguous, so "part 7" could misleadingly suggest a huge or broken result when it's
 * really just "the 7th chunk happened to also be relevant."
 */
/**
 * Same page/section formatting as the UI's own formatSources (app/ask/ask-form.tsx,
 * app/ask/history/page.tsx) — kept as an independent copy rather than a shared module, matching
 * this codebase's existing tolerance for small per-layer duplication (see ask-form.tsx's own
 * comment on formatSources). This copy's audience is Claude, not a doctor reading the page, so it
 * doesn't need to match verbatim — only convey the same location.
 */
function formatLocation(chunk: RetrievedChunk): string {
  const page =
    chunk.page_start == null
      ? ""
      : chunk.page_start === chunk.page_end
        ? `, p. ${chunk.page_start}`
        : `, pp. ${chunk.page_start}-${chunk.page_end}`;
  const section = chunk.section ? `, sec. ${chunk.section}` : "";
  return `${page}${section}`;
}

export function buildUserPrompt(query: string, chunks: RetrievedChunk[]): string {
  const countByDoc = new Map<string, number>();
  for (const c of chunks) countByDoc.set(c.document_id, (countByDoc.get(c.document_id) ?? 0) + 1);
  const seenByDoc = new Map<string, number>();

  const sourceList = chunks
    .map((chunk, i) => {
      const total = countByDoc.get(chunk.document_id)!;
      let suffix = "";
      if (total > 1) {
        const seen = (seenByDoc.get(chunk.document_id) ?? 0) + 1;
        seenByDoc.set(chunk.document_id, seen);
        suffix = ` (excerpt ${seen} of ${total})`;
      }
      const excerpt = chunk.chunk_text.slice(0, CHUNK_EXCERPT_CHAR_BUDGET);
      return `[${i + 1}] ${chunk.source} (Tier ${chunk.tier}${formatLocation(chunk)}): ${chunk.title}${suffix}\n${excerpt}`;
    })
    .join("\n\n");

  return `Question: ${query}\n\nSources:\n${sourceList}`;
}

async function callClaude(client: Anthropic, systemPrompt: string, userPrompt: string) {
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response contained no text block");
  }
  return textBlock.text;
}

/**
 * Calls Claude, mechanically validates the citations (validateCitations — the concrete
 * enforcement of "No-Citation, No-Output"), and retries once with a corrective instruction if
 * validation fails. Throws NoCitationError if the retry also fails.
 */
export async function synthesizeAnswer(
  query: string,
  chunks: RetrievedChunk[],
): Promise<SynthesisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(query, chunks);

  const firstAttempt = await callClaude(client, SYSTEM_PROMPT, userPrompt);
  const firstValidation = validateCitations(firstAttempt, chunks);
  if (firstValidation.valid) {
    return { responseText: firstAttempt, citations: firstValidation.citations };
  }

  const correctivePrompt = `${userPrompt}\n\nYour previous response was rejected: ${firstValidation.reason}. Regenerate your answer, following the citation rule exactly — every claim needs a [n] marker referencing only the sources listed above.`;
  const secondAttempt = await callClaude(client, SYSTEM_PROMPT, correctivePrompt);
  const secondValidation = validateCitations(secondAttempt, chunks);
  if (secondValidation.valid) {
    return { responseText: secondAttempt, citations: secondValidation.citations };
  }

  throw new NoCitationError(
    `Claude's response failed citation validation twice: ${secondValidation.reason}`,
  );
}
