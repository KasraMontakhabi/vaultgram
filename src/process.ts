#!/usr/bin/env node
import { loadConfig } from "./config";
import { preflight, runPipeline, PipelineError } from "./pipeline";

function fail(message: string): never {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node dist/process.js <instagram-url>");
    process.exit(1);
  }

  const config = loadConfig();

  try {
    await preflight(config, (msg) => console.log(`[preflight] ${msg}`));
    console.log();
    const { notePath } = await runPipeline(url, config, (msg) => console.log(msg));
    console.log(`\nDone. Note written to:\n${notePath}`);
  } catch (err) {
    if (err instanceof PipelineError) fail(err.message);
    throw err;
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
