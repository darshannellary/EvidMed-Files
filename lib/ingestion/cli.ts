import { isDocumentSource } from "./types";
import { ingestDocument } from "./pipeline";

function parseArgs(argv: string[]) {
  let filePath: string | undefined;
  let source: string | undefined;
  let tier: string | undefined;
  let title: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--source=")) {
      source = arg.slice("--source=".length);
    } else if (arg.startsWith("--tier=")) {
      tier = arg.slice("--tier=".length);
    } else if (arg.startsWith("--title=")) {
      title = arg.slice("--title=".length);
    } else if (!arg.startsWith("--")) {
      filePath = arg;
    }
  }

  if (!filePath) {
    throw new Error("Missing file path. Usage: npm run ingest -- <file> --source=X --tier=N --title=\"...\"");
  }
  if (!source || !isDocumentSource(source)) {
    throw new Error(
      `Missing or invalid --source (got ${JSON.stringify(source)}). Valid values: ICMR, NHM, NCDC, EssentialMedicinesList, PubMedCentral, Cochrane, medRxiv.`,
    );
  }
  if (!tier || (tier !== "1" && tier !== "2")) {
    throw new Error(`Missing or invalid --tier (got ${JSON.stringify(tier)}). Must be 1 or 2.`);
  }
  if (!title) {
    throw new Error('Missing --title="...".');
  }

  return { filePath, source, tier: Number(tier) as 1 | 2, title };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { id, chunkCount } = await ingestDocument(args);
  console.log(`Ingested "${args.title}" as document ${id} (${chunkCount} chunk(s))`);
}

main().catch((err) => {
  console.error(`[ingest] failed: ${(err as Error).message}`);
  process.exit(1);
});
