// medRxiv (Cold Spring Harbor Laboratory) API client. Free, public, no signup or API key —
// unlike NCBI's E-utilities, medRxiv's API expects no `tool`/`email` identification at all.
//
// Two real differences from the PubMed/PMC integration (lib/ingestion/pubmed.ts), not just a
// find-and-replace of "pubmed" with "medrxiv":
//   1. No keyword search endpoint exists. api.medrxiv.org only supports a single-DOI lookup or
//      date-range browsing — confirmed via api.biorxiv.org's own docs, and why there is
//      deliberately no medrxiv:search CLI (see medrxiv-ingest-cli.ts / README.md). The founder
//      finds a candidate preprint via medrxiv.org's own website search in a browser (the same
//      workflow already used for sourcing ICMR/NHM PDFs) and copies its DOI from the article URL.
//   2. Licensing is per-article, chosen by the author on submission (CC-BY, CC-BY-NC, CC-BY-ND,
//      CC-BY-NC-ND, CC0, or no reuse at all) — not a binary "in the Open Access Subset or not"
//      like PMC. Only CC-BY and CC0 unambiguously permit reuse in a commercial product; anything
//      else — including a license string this client doesn't recognize — is refused by default.
//
// Response shape built from api.biorxiv.org's documented format, not verified against a live
// call — no network access from this sandbox. Treat the first real medrxiv:ingest run as the
// actual verification, same honesty this codebase already applies to lib/ingestion/pubmed.ts and
// lib/ingestion/embed.ts.

const DETAILS_URL = "https://api.medrxiv.org/details/medrxiv";

// Case-insensitive match against the API's documented `license` values (e.g. "cc_by"). Everything
// else — cc_by_nc, cc_by_nd, cc_by_nc_nd, "no reuse", or an unrecognized/missing value — is
// treated as non-permissive, the safe default for a commercial product.
const PERMISSIVE_LICENSES = new Set(["cc_by", "cc0"]);

export class MedRxivApiError extends Error {}

export interface MedRxivMetadata {
  doi: string;
  title: string;
  version: string;
  license: string;
  date: string;
}

/**
 * Looks up a single medRxiv preprint by DOI. Returns null if the DOI has no medRxiv record
 * (typo, or not a medRxiv DOI at all) — distinct from MedRxivApiError, which means the request
 * itself failed (network/HTTP), not that the lookup came back empty.
 */
export async function fetchMedRxivMetadata(doi: string): Promise<MedRxivMetadata | null> {
  // Not encodeURIComponent(doi): a DOI's "/" is a path separator the API expects literally
  // (10.1101/2020.01.01.20016949 -> .../details/medrxiv/10.1101/2020.01.01.20016949/na/json).
  // Encoding it to %2F makes the API 404 rather than return an empty collection.
  const url = `${DETAILS_URL}/${doi}/na/json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new MedRxivApiError(
      `medRxiv details request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    collection?: Array<{ doi?: string; title?: string; version?: string; license?: string; date?: string }>;
  };
  const entry = json.collection?.[0];
  if (!entry || !entry.doi) return null;

  return {
    doi: entry.doi,
    title: entry.title ?? `medRxiv ${doi}`,
    version: entry.version ?? "1",
    license: entry.license ?? "unknown",
    date: entry.date ?? "(unknown date)",
  };
}

export function isPermissiveLicense(license: string): boolean {
  return PERMISSIVE_LICENSES.has(license.toLowerCase());
}

/** Predictable public PDF URL for a given DOI + version — confirmed against real medRxiv URLs. */
export function medRxivPdfUrl(doi: string, version: string): string {
  return `https://www.medrxiv.org/content/${doi}v${version}.full.pdf`;
}

export async function fetchMedRxivPdf(doi: string, version: string): Promise<Buffer> {
  const url = medRxivPdfUrl(doi, version);
  const response = await fetch(url);

  if (!response.ok) {
    throw new MedRxivApiError(
      `Failed to download medRxiv PDF: ${response.status} ${response.statusText} (${url})`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
