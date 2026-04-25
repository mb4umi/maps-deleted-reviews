import type { RawScraperConfig } from './types.js';

export interface CliArgs {
  configPath: string;
  overrides: RawScraperConfig;
}

export function parseCliArgs(args: string[]): CliArgs {
  const overrides: RawScraperConfig = {};
  let configPath = 'config.json';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--config' || arg === '-c') {
      configPath = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--city') {
      overrides.city = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--cities') {
      overrides.cities = parseCommaSeparated(requireValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === '--country') {
      overrides.country = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--searchTerm' || arg === '--search-term') {
      overrides.searchTerm = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--searchTerms' || arg === '--search-terms') {
      overrides.searchTerms = parseCommaSeparated(requireValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === '--depth') {
      overrides.depth = Number(requireValue(arg, next));
      index += 1;
      continue;
    }
    if (arg === '--resumeMode' || arg === '--resume-mode') {
      overrides.resumeMode = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--outputCsvPath' || arg === '--output-csv-path') {
      overrides.outputCsvPath = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--statePath' || arg === '--state-path') {
      overrides.statePath = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--summaryPath' || arg === '--summary-path') {
      overrides.summaryPath = requireValue(arg, next);
      index += 1;
      continue;
    }
    if (arg === '--headed') {
      overrides.headed = true;
      continue;
    }
    if (arg === '--headless') {
      overrides.headed = false;
      continue;
    }
    if (!arg.startsWith('-') && configPath === 'config.json') {
      configPath = arg;
    }
  }

  return { configPath, overrides };
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}
