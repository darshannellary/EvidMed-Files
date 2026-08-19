import { backfillEmbeddings } from "./pipeline";

async function main() {
  const { succeeded, failed } = await backfillEmbeddings();
  console.log(`Backfilled ${succeeded} document(s), ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`[backfill] failed: ${(err as Error).message}`);
  process.exit(1);
});
