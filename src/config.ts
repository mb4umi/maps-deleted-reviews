import { readFile } from 'node:fs/promises';
import type { RawScraperConfig, ScraperConfig } from './types.js';

const DEFAULT_CONFIG: Omit<
  ScraperConfig,
  'city' | 'country' | 'searchTerm' | 'depth' | 'outputCsvPath' | 'summaryPath' | 'statePath'
> = {
  locale: 'de-DE',
  googleMapsUrl: 'https://www.google.de/maps',
  headed: true,
  resumeMode: 'pause',
  browserProfileDir: '.playwright-profile',
  navigationTimeoutMs: 45_000,
  actionDelay: {
    minMs: 0,
    maxMs: 0,
  },
  resultScrollDelayMs: 250,
  maxResultScrolls: 80,
};

export async function loadConfig(configPath: string): Promise<ScraperConfig> {
  const raw = await readFile(configPath, 'utf8');
  return normalizeConfig(JSON.parse(raw) as RawScraperConfig);
}

export async function loadConfigs(
  configPath: string,
  overrides: RawScraperConfig = {},
): Promise<ScraperConfig[]> {
  const raw = await readFile(configPath, 'utf8');
  const merged = { ...(JSON.parse(raw) as RawScraperConfig), ...overrides };
  if (overrides.searchTerm && !overrides.searchTerms) {
    merged.searchTerms = undefined;
  }
  return normalizeConfigs(merged);
}

export function normalizeConfigs(raw: RawScraperConfig): ScraperConfig[] {
  const searchTerms = raw.searchTerms?.length ? raw.searchTerms : undefined;
  if (!searchTerms) {
    return [normalizeConfig(raw)];
  }

  if (raw.outputCsvPath || raw.statePath || raw.summaryPath) {
    throw new Error(
      'Invalid config: outputCsvPath, statePath, and summaryPath cannot be set when using searchTerms',
    );
  }

  return searchTerms.map((searchTerm) =>
    normalizeConfig({
      ...raw,
      searchTerm,
      searchTerms: undefined,
    }),
  );
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
    summaryPath: raw.summaryPath ?? `output/summary-${slugify(merged.city)}-${slugify(merged.searchTerm)}.json`,
    statePath: raw.statePath ?? `output/state-${slugify(merged.city)}-${slugify(merged.searchTerm)}.json`,
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
