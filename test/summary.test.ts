import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatRunSummary, writeRunSummary } from '../src/summary.js';
import type { RunSummary } from '../src/types.js';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { force: true, recursive: true });
    tempDir = undefined;
  }
});

const summary: RunSummary = {
  city: 'Bonn',
  country: 'Germany',
  searchTerm: 'restaurant',
  depth: 50,
  outputCsvPath: 'output/deleted-reviews-bonn-restaurant.csv',
  statePath: 'output/state-bonn-restaurant.json',
  summaryPath: 'output/summary-bonn-restaurant.json',
  discoveredVenues: 50,
  completedVenues: 49,
  failedVenues: 1,
  csvRows: 50,
  okRows: 48,
  partialRows: 1,
  failedRows: 1,
  deletionNoticesFound: 4,
  startedAt: '2026-04-25T18:00:00.000Z',
  finishedAt: '2026-04-25T18:01:30.000Z',
  durationMs: 90_000,
};

describe('formatRunSummary', () => {
  it('formats the key run totals', () => {
    expect(formatRunSummary(summary)).toContain('Notices found: 4');
    expect(formatRunSummary(summary)).toContain('Runtime: 90s');
  });
});

describe('writeRunSummary', () => {
  it('writes summary JSON', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-summary-'));
    const summaryPath = join(tempDir, 'summary.json');

    await writeRunSummary({ ...summary, summaryPath });

    expect(JSON.parse(await readFile(summaryPath, 'utf8'))).toMatchObject({
      searchTerm: 'restaurant',
      deletionNoticesFound: 4,
    });
  });
});
