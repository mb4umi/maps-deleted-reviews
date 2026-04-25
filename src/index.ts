#!/usr/bin/env node

import { copyFile, access } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { runScraper } from './mapsScraper.js';

async function main(): Promise<void> {
  const configPath = getConfigPath(process.argv.slice(2));
  await ensureConfigExists(configPath);
  const config = await loadConfig(configPath);

  console.log(
    `Scraping ${config.depth} "${config.searchTerm}" venues in ${config.city}, ${config.country}.`,
  );
  console.log(`Output: ${config.outputCsvPath}`);
  console.log(`State: ${config.statePath}`);

  await runScraper(config);
  console.log('Done.');
}

function getConfigPath(args: string[]): string {
  const configIndex = args.findIndex((arg) => arg === '--config' || arg === '-c');
  if (configIndex >= 0) {
    return args[configIndex + 1] ?? 'config.json';
  }

  return args[0] ?? 'config.json';
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
