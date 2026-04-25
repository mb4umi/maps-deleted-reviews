import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ScraperState, Venue } from './types.js';

export function createInitialState(): ScraperState {
  return {
    discoveredVenues: [],
    completedUrls: [],
    failedUrls: [],
    cursor: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadOrCreateState(statePath: string): Promise<ScraperState> {
  try {
    const raw = await readFile(statePath, 'utf8');
    return normalizeState(JSON.parse(raw) as Partial<ScraperState>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }

    const state = createInitialState();
    await saveState(statePath, state);
    return state;
  }
}

export async function saveState(statePath: string, state: ScraperState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function upsertDiscoveredVenue(state: ScraperState, venue: Venue): void {
  const exists = state.discoveredVenues.some(
    (candidate) => candidate.url === venue.url || normalizeVenueKey(candidate) === normalizeVenueKey(venue),
  );
  if (!exists) {
    state.discoveredVenues.push(venue);
  }
}

export function markVenueCompleted(state: ScraperState, url: string): void {
  if (!state.completedUrls.includes(url)) {
    state.completedUrls.push(url);
  }
  state.failedUrls = state.failedUrls.filter((failedUrl) => failedUrl !== url);

  while (
    state.cursor < state.discoveredVenues.length &&
    state.completedUrls.includes(state.discoveredVenues[state.cursor]?.url ?? '')
  ) {
    state.cursor += 1;
  }
}

export function markVenueFailed(state: ScraperState, url: string): void {
  if (!state.failedUrls.includes(url)) {
    state.failedUrls.push(url);
  }
}

function normalizeState(raw: Partial<ScraperState>): ScraperState {
  return {
    discoveredVenues: raw.discoveredVenues ?? [],
    completedUrls: raw.completedUrls ?? [],
    failedUrls: raw.failedUrls ?? [],
    cursor: raw.cursor ?? 0,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeVenueKey(venue: Venue): string {
  return `${venue.name} ${venue.address ?? ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
}
