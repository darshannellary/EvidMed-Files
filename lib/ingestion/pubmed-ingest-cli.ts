import { ingestFromPubMed } from "./pipeline";

function parseArgs(argv: string[]) {
  let pmid: string | undefined;
  let title: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--pmid=")) {
      pmid = arg.slice("--pmid=".length);
    } else if (arg.startsWith("--title=")) {
      title = arg.slice("--title=".length);
    }
  }

  if (!pmid) {
    throw new Error('Missing --pmid=<pmid>. Usage: npm run pubmed:ingest -- --pmid=12345678 [--title="..."]');
  }

  return { pmid, title };
}

async function main() {
  const { pmid, title } = parseArgs(process.argv.slice(2));
  const { id, chunkCount, pmcid } = await ingestFromPubMed({ pmid, title });
  console.log(`Ingested PMID ${pmid} (${pmcid}) as document ${id} (${chunkCount} chunk(s)).`);
}

main().catch((err) => {
  console.error(`[pubmed-ingest] failed: ${(err as Error).message}`);
  process.exit(1);
});
