import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedDocument, SynthesisResult } from "./types";
import { validateCitations } from "./validate";

const CLAUDE_MODEL = "claude-sonnet-5";
// Per-doc excerpt budget for the prompt — a latency/context budget distinct from the ingestion
// pipeline's 100K embedding budget, sized to keep the round trip within the product's <10s target
// across up to 8 documents.
const DOC_EXCERPT_CHAR_BUDGET = 4000;

export class NoCitationError extends Error {}

const SYSTEM_PROMPT = `You are EvidMed AI, a research-synthesis assistant for verified Indian doctors. You inform clinical research — you never diagnose, prescribe, or issue treatment directives.

Rules, no exceptions:
1. Descriptive, not directive. Phrase findings as "guidelines indicate...", "evidence suggests...", "the cited source recommends...". Never as an instruction to the doctor: do NOT write "administer X", "you should prescribe Y", "the patient must receive Z".
2. Every factual or clinical claim must end with one or more citation markers like [1] or [2][3], referencing the numbered sources below. No exceptions — an uncited claim is not allowed.
3. Only cite sources that are actually provided below. Never invent a citation number outside the provided list.
4. If the provided sources don't address the question, say so explicitly rather than answering from general knowledge.
5. Plain prose only. Put citation markers inline, mid-sentence or at sentence end. Do not add a separate "References" section.`;

export function buildUserPrompt(query: string, docs: RetrievedDocument[]): string {
  const sourceList = docs
    .map((doc, i) => {
      const excerpt = doc.raw_text.slice(0, DOC_EXCERPT_CHAR_BUDGET);
      return `[${i + 1}] ${doc.source} (Tier ${doc.tier}): ${doc.title}\n${excerpt}`;
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
  docs: RetrievedDocument[],
): Promise<SynthesisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(query, docs);

  const firstAttempt = await callClaude(client, SYSTEM_PROMPT, userPrompt);
  const firstValidation = validateCitations(firstAttempt, docs);
  if (firstValidation.valid) {
    return { responseText: firstAttempt, citations: firstValidation.citations };
  }

  const correctivePrompt = `${userPrompt}\n\nYour previous response was rejected: ${firstValidation.reason}. Regenerate your answer, following the citation rule exactly — every claim needs a [n] marker referencing only the sources listed above.`;
  const secondAttempt = await callClaude(client, SYSTEM_PROMPT, correctivePrompt);
  const secondValidation = validateCitations(secondAttempt, docs);
  if (secondValidation.valid) {
    return { responseText: secondAttempt, citations: secondValidation.citations };
  }

  throw new NoCitationError(
    `Claude's response failed citation validation twice: ${secondValidation.reason}`,
  );
}
