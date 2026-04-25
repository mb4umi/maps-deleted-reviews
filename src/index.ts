#!/usr/bin/env node

import { copyFile, access } from 'node:fs/promises';
import { parseCliArgs } from './cli.js';
import { loadConfigs } from './config.js';
import { runScraper } from './mapsScraper.js';
import { formatRunSummary, writeRunSummary } from './summary.js';

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  const configPath = cli.configPath;
  await ensureConfigExists(configPath);
  const configs = await loadConfigs(configPath, cli.overrides);

  for (const config of configs) {
    console.log(
      `Scraping ${config.depth} "${config.searchTerm}" venues in ${config.city}, ${config.country}.`,
    );
    console.log(`Output: ${config.outputCsvPath}`);
    console.log(`State: ${config.statePath}`);

    const summary = await runScraper(config);
    await writeRunSummary(summary);
    console.log(formatRunSummary(summary));
  }
  console.log('Done.');
}

async function ensureConfigExists(configPath: string): Promise<void> {
  try {
    await access(configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }

    if (configPath === 'config.json') {
      await copyFile('config.example.json', configPath);
      throw new Error(
        'Created config.json from config.example.json. Review it, then run the command again.',
      );
    }

    throw error;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
