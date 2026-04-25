import { readFile } from 'node:fs/promises';
import type { RawScraperConfig, ScraperConfig } from './types.js';

const DEFAULT_CONFIG: Omit<
  ScraperConfig,
  'city' | 'country' | 'searchTerm' | 'depth' | 'outputCsvPath'
> = {
  locale: 'de-DE',
  googleMapsUrl: 'https://www.google.de/maps',
  headed: true,
  resumeMode: 'pause',
  statePath: 'output/state.json',
  browserProfileDir: '.playwright-profile',
  navigationTimeoutMs: 45_000,
  actionDelay: {
    minMs: 1_300,
    maxMs: 1_300,
  },
  resultScrollDelayMs: 1_300,
  maxResultScrolls: 80,
};

export async function loadConfig(configPath: string): Promise<ScraperConfig> {
  const raw = await readFile(configPath, 'utf8');
  return normalizeConfig(JSON.parse(raw) as RawScraperConfig);
}

export function normalizeConfig(raw: RawScraperConfig): ScraperConfig {
  const merged = {
    ...DEFAULT_CONFIG,
    ...raw,
    actionDelay: {
      ...DEFAULT_CONFIG.actionDelay,
      ...raw.actionDelay,
    },
  };

  const errors: string[] = [];
  if (!isNonEmptyString(merged.city)) {
    errors.push('city must be a non-empty string');
  }
  if (!isNonEmptyString(merged.country)) {
    errors.push('country must be a non-empty string');
  }
  if (!isNonEmptyString(merged.searchTerm)) {
    errors.push('searchTerm must be a non-empty string');
  }
  if (typeof merged.depth !== 'number' || !Number.isInteger(merged.depth) || merged.depth <= 0) {
    errors.push('depth must be a positive integer');
  }
  if (merged.resumeMode !== 'pause' && merged.resumeMode !== 'stop') {
    errors.push('resumeMode must be either "pause" or "stop"');
  }
  if (merged.actionDelay.minMs < 0 || merged.actionDelay.maxMs < merged.actionDelay.minMs) {
    errors.push('actionDelay must have non-negative minMs and maxMs >= minMs');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid config: ${errors.join('; ')}`);
  }

  return {
    ...merged,
    outputCsvPath:
      raw.outputCsvPath ?? `output/deleted-reviews-${slugify(merged.city)}-${slugify(merged.searchTerm)}.csv`,
  } as ScraperConfig;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function slugify(value: string | undefined): string {
  return (value ?? 'unknown')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
