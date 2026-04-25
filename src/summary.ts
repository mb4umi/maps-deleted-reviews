import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RunSummary } from './types.js';

export async function writeRunSummary(summary: RunSummary): Promise<void> {
  await mkdir(dirname(summary.summaryPath), { recursive: true });
  await writeFile(summary.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

export function formatRunSummary(summary: RunSummary): string {
  return [
    `Summary for ${summary.searchTerm} in ${summary.city}, ${summary.country}`,
    `- Discovered: ${summary.discoveredVenues}`,
    `- Completed: ${summary.completedVenues}`,
    `- CSV rows: ${summary.csvRows}`,
    `- Notices found: ${summary.deletionNoticesFound}`,
    `- Partial rows: ${summary.partialRows}`,
    `- Failed rows: ${summary.failedRows}`,
    `- Runtime: ${Math.round(summary.durationMs / 1000)}s`,
    `- Summary: ${summary.summaryPath}`,
  ].join('\n');
}
