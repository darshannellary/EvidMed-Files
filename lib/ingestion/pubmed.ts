// NCBI E-utilities / PMC API client. Free, public, no paid tier — 3 req/sec without NCBI_API_KEY,
// up to 10/sec with one (obtained via a free NCBI account). NCBI's usage policy expects a `tool`
// and `email` identifying the caller on every request, so both are appended below.
//
// Response shapes here are built from NCBI's documented formats, not verified against a live
// call — no real NCBI_API_EMAIL/network access exists in this sandbox. Treat these as the first
// real exercise of this integration, same honesty this codebase already applies to
// lib/ingestion/embed.ts's Voyage response-shape assumptions.

import type { ExtractedParagraph } from "./types";

// BioC's `section_type` infon is a coarse, fixed vocabulary (see PMC's BioC documentation) — not
// an article-specific heading like "Statistical Analysis," but still real structure straight from
// PMC's own markup, unlike anything derivable from a plain-text PDF. Only mapped values are ever
// used as a citation's `section`; an unrecognized or absent section_type yields null rather than
// showing the raw enum string (e.g. "SUPPL_LEG") to a doctor.
const BIOC_SECTION_LABELS: Record<string, string> = {
  TITLE: "Title",
  ABSTRACT: "Abstract",
  INTRO: "Introduction",
  METHODS: "Methods",
  RESULTS: "Results",
  DISCUSS: "Discussion",
  CONCL: "Conclusion",
  CASE: "Case Report",
  REF: "References",
  SUPPL: "Supplementary Material",
  COMP_INT: "Competing Interests",
  AUTH_CONT: "Author Contributions",
  ACK_FUND: "Acknowledgments/Funding",
};

const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const IDCONV_URL = "https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles";
const BIOC_PMC_URL = "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi";

const DEFAULT_MAX_SEARCH_RESULTS = 20;

export class PubMedApiError extends Error {}

export interface PubMedSearchResult {
  pmid: string;
  title: string;
  journal: string;
  pubDate: string;
}

function ncbiParams(extra: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(extra);
  params.set("tool", "EvidMedAI");

  const email = process.env.NCBI_API_EMAIL;
  if (email) params.set("email", email);

  const apiKey = process.env.NCBI_API_KEY;
  if (apiKey) params.set("api_key", apiKey);

  return params;
}

async function fetchJson(url: string, params: URLSearchParams, label: string): Promise<unknown> {
  const response = await fetch(`${url}?${params.toString()}`);
  if (!response.ok) {
    throw new PubMedApiError(`${label} request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Keyword search: esearch (PMIDs) then one batched esummary call (title/journal/pubdate) for
 * all of them. This is what powers the review list in `pubmed:search` — the founder picks a PMID
 * from here, then passes it to `ingestFromPubMed`.
 */
export async function searchPubMed(
  query: string,
  maxResults: number = DEFAULT_MAX_SEARCH_RESULTS,
): Promise<PubMedSearchResult[]> {
  // "free full text[Filter]" cuts down on results that turn out not to be in the PMC Open Access
  // Subset (what fetchPmcFullText actually serves) — but it's not a perfect guarantee: "free to
  // read" and "freely redistributable" (what the OA Subset specifically is) aren't identical, so
  // ingestFromPubMed can still legitimately reject a result from this filtered search.
  const searchParams = ncbiParams({
    db: "pubmed",
    term: `${query} AND free full text[Filter]`,
    retmode: "json",
    retmax: String(maxResults),
  });

  const searchJson = (await fetchJson(ESEARCH_URL, searchParams, "esearch")) as {
    esearchresult?: { idlist?: string[] };
  };
  const pmids = searchJson.esearchresult?.idlist ?? [];
  if (pmids.length === 0) return [];

  const summaryParams = ncbiParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "json",
  });

  const summaryJson = (await fetchJson(ESUMMARY_URL, summaryParams, "esummary")) as {
    result?: Record<string, { title?: string; fulljournalname?: string; source?: string; pubdate?: string }>;
  };
  const result = summaryJson.result ?? {};

  return pmids.map((pmid) => {
    const entry = result[pmid] ?? {};
    return {
      pmid,
      title: entry.title ?? "(no title)",
      journal: entry.fulljournalname ?? entry.source ?? "(unknown journal)",
      pubDate: entry.pubdate ?? "(unknown date)",
    };
  });
}

/**
 * Returns the PMCID for a given PMID, or null if the article has no PMC record at all (was
 * never deposited there — distinct from "in PMC but not Open Access", which is what
 * fetchPmcFullText's null return means).
 */
export async function convertPmidToPmcid(pmid: string): Promise<string | null> {
  const params = ncbiParams({ ids: pmid, idtype: "pmid", format: "json" });
  const json = (await fetchJson(IDCONV_URL, params, "PMC ID Converter")) as {
    records?: Array<{ pmcid?: string; status?: string; errmsg?: string }>;
  };

  const record = json.records?.[0];
  if (!record || record.status === "error" || !record.pmcid) {
    return null;
  }
  return record.pmcid;
}

/**
 * Fetches full text via the BioC-PMC API, which only serves PMC Open Access Subset content —
 * a failed or empty response IS the "not in the OA subset" signal, not a separate status check.
 * Returns null in that case (expected, not an error); throws PubMedApiError only on a genuine
 * network/HTTP failure.
 *
 * Each BioC passage becomes one paragraph directly — no re-joining into one blob and re-splitting
 * on blank lines the way the PDF path has to, since BioC already hands back real, pre-segmented
 * units. PMC full text has no page concept (page is always null here); section comes from each
 * passage's own `infons.section_type` where BioC provides one recognized (see BIOC_SECTION_LABELS).
 */
export async function fetchPmcFullText(
  pmcid: string,
): Promise<{ paragraphs: ExtractedParagraph[]; warnings: string[] } | null> {
  const url = `${BIOC_PMC_URL}/BioC_json/${pmcid}/unicode`;
  const response = await fetch(url);

  if (response.status === 404 || response.status === 400) {
    return null;
  }
  if (!response.ok) {
    throw new PubMedApiError(`BioC-PMC request failed: ${response.status} ${response.statusText}`);
  }

  // The API returns 200 with a plain-text/HTML "[Error] : No result can be found." body — not a
  // 404/400 — when the article isn't in the Open Access subset. That's the same "not available"
  // signal as the 404/400 case above, just delivered with a 200 status.
  const rawBody = await response.text();
  let json: Array<{
    documents?: Array<{
      passages?: Array<{ text?: string; infons?: Record<string, string> }>;
    }>;
  }>;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }

  // The response is a top-level array of BioCCollection objects, not a single object — a prior
  // version of this code read `json.documents` directly and always got undefined, silently
  // treating every real Open Access article as "not available."
  const passages = json[0]?.documents?.[0]?.passages ?? [];
  const paragraphs: ExtractedParagraph[] = passages
    .map((p) => ({ text: p.text?.trim() ?? "", infons: p.infons }))
    .filter((p) => p.text.length > 0)
    .map((p) => {
      const sectionType = p.infons?.section_type;
      return {
        text: p.text,
        page: null,
        section: (sectionType && BIOC_SECTION_LABELS[sectionType]) ?? null,
      };
    });

  if (paragraphs.length === 0) return null;

  const warnings: string[] = [];
  if (paragraphs.length < 5) {
    warnings.push(`Only ${paragraphs.length} passage(s) returned — full text may be incomplete.`);
  }

  return { paragraphs, warnings };
}
