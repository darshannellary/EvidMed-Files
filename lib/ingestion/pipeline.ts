import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromPdf } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import {
  insertDocument,
  insertDocumentChunks,
  backfillChunkEmbedding,
  type ChunkInsertPayload,
} from "./insert";
import { convertPmidToPmcid, fetchPmcFullText, searchPubMed } from "./pubmed";
import { fetchMedRxivMetadata, fetchMedRxivPdf, isPermissiveLicense } from "./medrxiv";
import { assertSourceTierMatch, type DocumentSource, type DocumentTier } from "./types";

// Embedding batch size for Voyage calls — a placeholder, not verified against Voyage's actual
// current per-request text-array/token limits (no live network access to check from this
// sandbox). Sanity-check before ingesting an unusually large document. Batching (rather than one
// call per chunk, or one call for the whole document) balances latency/API-call count against
// blast radius: a failed batch only nulls out ~32 chunks, not potentially hundreds, and
// backfillEmbeddings() has less to redo.
const EMBED_BATCH_SIZE = 32;

/**
 * Shared by every ingestion entry point (PDF, PubMed, and any future source): chunk the already-
 * extracted text, embed each chunk in batches (two-phase nullable-embedding fallback per batch,
 * not per document), insert the parent document row and its chunks.
 */
async function ingestExtractedText(
  admin: SupabaseClient,
  args: {
    source: DocumentSource;
    tier: DocumentTier;
    title: string;
    text: string;
    externalId?: string;
    sourceUrl?: string;
  },
): Promise<{ id: string; chunkCount: number }> {
  const { source, tier, title, text, externalId, sourceUrl } = args;

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error(`"${title}": chunking produced zero chunks from extracted text`);
  }
  if (chunks.length > 200) {
    console.warn(`[ingest] "${title}": ${chunks.length} chunks — unusually large document`);
  }

  const { id: documentId } = await insertDocument(admin, {
    source,
    tier,
    title,
    raw_text: text,
    external_id: externalId,
    source_url: sourceUrl,
  });

  const payloads: ChunkInsertPayload[] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    try {
      const embeddings = await embedTexts(batch, "document");
      batch.forEach((t, j) =>
        payloads.push({ chunkIndex: i + j, chunkText: t, embedding: embeddings[j] }),
      );
    } catch (err) {
      // Two-phase fallback: store the chunks now, backfill embeddings later via
      // backfillEmbeddings(). Scoped to this batch, not the whole document, so a transient
      // failure only nulls out ~EMBED_BATCH_SIZE chunks.
      console.error(
        `[ingest] "${title}": embedding batch [${i}-${i + batch.length}) failed, inserting with embedding=null: ${(err as Error).message}`,
      );
      batch.forEach((t, j) => payloads.push({ chunkIndex: i + j, chunkText: t, embedding: null }));
    }
  }

  await insertDocumentChunks(admin, documentId, payloads);
  return { id: documentId, chunkCount: payloads.length };
}

export interface IngestDocumentArgs {
  filePath: string;
  source: DocumentSource;
  tier: DocumentTier;
  title: string;
}

export async function ingestDocument(
  args: IngestDocumentArgs,
): Promise<{ id: string; chunkCount: number }> {
  const { filePath, source, tier, title } = args;

  assertSourceTierMatch(source, tier);

  const buffer = await readFile(filePath);
  const { text, warnings } = await extractTextFromPdf(buffer);
  for (const warning of warnings) {
    console.warn(`[ingest] ${filePath}: ${warning}`);
  }

  const admin = createAdminClient();
  return ingestExtractedText(admin, { source, tier, title, text });
}

export interface IngestFromPubMedArgs {
  pmid: string;
  title?: string;
}

/**
 * Full-text-only, no abstract fallback: an article not in the PMC Open Access Subset is refused,
 * not silently substituted with a thin ~250-word abstract standing in for real Tier-2 evidence.
 */
export async function ingestFromPubMed(
  args: IngestFromPubMedArgs,
): Promise<{ id: string; chunkCount: number; pmcid: string }> {
  const { pmid } = args;
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("documents")
    .select("id")
    .eq("source", "PubMedCentral")
    .eq("external_id", pmid)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check for an existing document: ${existingError.message}`);
  }
  if (existing) {
    throw new Error(`PMID ${pmid} was already ingested as document ${existing.id}.`);
  }

  const pmcid = await convertPmidToPmcid(pmid);
  if (!pmcid) {
    throw new Error(`PMID ${pmid} has no PMC record — it was never deposited in PubMed Central.`);
  }

  const fullText = await fetchPmcFullText(pmcid);
  if (!fullText) {
    throw new Error(
      `PMID ${pmid} (${pmcid}) is not in the PMC Open Access Subset — no full text available for ingestion.`,
    );
  }
  for (const warning of fullText.warnings) {
    console.warn(`[pubmed-ingest] ${pmid}: ${warning}`);
  }

  let title = args.title;
  if (!title) {
    const [summary] = await searchPubMed(pmid, 1);
    title = summary?.title ?? `PubMed ${pmid}`;
  }

  const { id, chunkCount } = await ingestExtractedText(admin, {
    source: "PubMedCentral",
    tier: 2,
    title,
    text: fullText.text,
    externalId: pmid,
    sourceUrl: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`,
  });

  return { id, chunkCount, pmcid };
}

export interface IngestFromMedRxivArgs {
  doi: string;
  title?: string;
}

/**
 * Licensed-only, no exceptions: medRxiv authors choose their own reuse license on submission, and
 * only CC-BY/CC0 unambiguously permit use in a commercial product. Anything else — including a
 * license string this client doesn't recognize — is refused, not silently ingested on the
 * assumption that "on medRxiv" implies "freely reusable" the way it might for a PMC OA article.
 */
export async function ingestFromMedRxiv(
  args: IngestFromMedRxivArgs,
): Promise<{ id: string; chunkCount: number; license: string }> {
  const { doi } = args;
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("documents")
    .select("id")
    .eq("source", "medRxiv")
    .eq("external_id", doi)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check for an existing document: ${existingError.message}`);
  }
  if (existing) {
    throw new Error(`DOI ${doi} was already ingested as document ${existing.id}.`);
  }

  const metadata = await fetchMedRxivMetadata(doi);
  if (!metadata) {
    throw new Error(`No medRxiv record found for DOI ${doi}.`);
  }
  if (!isPermissiveLicense(metadata.license)) {
    throw new Error(
      `DOI ${doi} is licensed "${metadata.license}", not CC-BY or CC0 — refusing to ingest into ` +
        "a commercial product without explicit permission from the author.",
    );
  }

  const pdfBuffer = await fetchMedRxivPdf(metadata.doi, metadata.version);
  const { text, warnings } = await extractTextFromPdf(pdfBuffer);
  for (const warning of warnings) {
    console.warn(`[medrxiv-ingest] ${doi}: ${warning}`);
  }

  const title = args.title ?? metadata.title;
  const { id, chunkCount } = await ingestExtractedText(admin, {
    source: "medRxiv",
    tier: 2,
    title,
    text,
    externalId: doi,
    sourceUrl: `https://www.medrxiv.org/content/${metadata.doi}v${metadata.version}`,
  });

  return { id, chunkCount, license: metadata.license };
}

export async function backfillEmbeddings(admin: SupabaseClient = createAdminClient()) {
  const { data, error } = await admin
    .from("document_chunks")
    .select("id, chunk_text")
    .is("embedding", null);

  if (error) {
    throw new Error(`Failed to query chunks needing backfill: ${error.message}`);
  }

  let succeeded = 0;
  let failed = 0;
  const rows = data ?? [];

  for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
    const batch = rows.slice(i, i + EMBED_BATCH_SIZE);
    let embeddings: number[][];
    try {
      embeddings = await embedTexts(
        batch.map((r) => r.chunk_text as string),
        "document",
      );
    } catch (err) {
      console.error(
        `[backfill] embedding batch starting at chunk ${batch[0]?.id}: ${(err as Error).message}`,
      );
      failed += batch.length;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      try {
        await backfillChunkEmbedding(admin, batch[j].id as string, embeddings[j]);
        succeeded++;
      } catch (err) {
        console.error(`[backfill] chunk ${batch[j].id}: ${(err as Error).message}`);
        failed++;
      }
    }
  }

  return { succeeded, failed };
}
