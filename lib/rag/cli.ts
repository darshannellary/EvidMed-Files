import { answerQuery } from "./pipeline";

function parseArgs(argv: string[]) {
  let doctorId: string | undefined;
  const rest: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--doctor-id=")) {
      doctorId = arg.slice("--doctor-id=".length);
    } else {
      rest.push(arg);
    }
  }

  const queryText = rest.join(" ").trim();

  if (!doctorId) {
    throw new Error('Missing --doctor-id=<uuid>. Usage: npm run query -- --doctor-id=<uuid> "question"');
  }
  if (!queryText) {
    throw new Error('Missing question text. Usage: npm run query -- --doctor-id=<uuid> "question"');
  }

  return { doctorId, queryText };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await answerQuery(args);

  console.log(`\n--- Answer (query ${result.queryId}, ${result.responseTimeMs}ms) ---\n`);
  console.log(result.responseText);
  console.log(`\n(${result.citationCount} citation(s) recorded)`);
}

main().catch((err) => {
  console.error(`[query] failed: ${(err as Error).message}`);
  process.exit(1);
});
