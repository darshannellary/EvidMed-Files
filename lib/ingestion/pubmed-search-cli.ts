import { searchPubMed } from "./pubmed";

function parseArgs(argv: string[]) {
  let query: string | undefined;
  let max = 20;

  for (const arg of argv) {
    if (arg.startsWith("--max=")) {
      max = Number(arg.slice("--max=".length));
    } else if (!arg.startsWith("--")) {
      query = arg;
    }
  }

  if (!query) {
    throw new Error('Missing search query. Usage: npm run pubmed:search -- "query text" [--max=20]');
  }
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error(`Invalid --max (got ${max}).`);
  }

  return { query, max };
}

async function main() {
  const { query, max } = parseArgs(process.argv.slice(2));
  const results = await searchPubMed(query, max);

  if (results.length === 0) {
    console.log("No results.");
    return;
  }

  for (const r of results) {
    console.log(`PMID ${r.pmid}  ${r.title}\n  ${r.journal} — ${r.pubDate}\n`);
  }
  console.log(
    `${results.length} result(s). To ingest one: npm run pubmed:ingest -- --pmid=<pmid> [--title="..."]`,
  );
}

main().catch((err) => {
  console.error(`[pubmed-search] failed: ${(err as Error).message}`);
  process.exit(1);
});
