import { ingestFromMedRxiv } from "./pipeline";

// No medrxiv-search-cli.ts alongside this — deliberately. Unlike PubMed's esearch, medRxiv's API
// has no keyword search endpoint at all (see lib/ingestion/medrxiv.ts). Find a candidate preprint
// via medrxiv.org's own website search in a browser, then copy its DOI from the article URL
// (the part after "content/", before "v1").

function parseArgs(argv: string[]) {
  let doi: string | undefined;
  let title: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--doi=")) {
      doi = arg.slice("--doi=".length);
    } else if (arg.startsWith("--title=")) {
      title = arg.slice("--title=".length);
    }
  }

  if (!doi) {
    throw new Error(
      'Missing --doi=<doi>. Usage: npm run medrxiv:ingest -- --doi=10.1101/2024.01.01.24300000 [--title="..."]',
    );
  }

  return { doi, title };
}

async function main() {
  const { doi, title } = parseArgs(process.argv.slice(2));
  const { id, chunkCount, license } = await ingestFromMedRxiv({ doi, title });
  console.log(`Ingested ${doi} (license: ${license}) as document ${id} (${chunkCount} chunk(s)).`);
}

main().catch((err) => {
  console.error(`[medrxiv-ingest] failed: ${(err as Error).message}`);
  process.exit(1);
});
