import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createInitialState,
  loadOrCreateState,
  markVenueFailed,
  markVenueCompleted,
  saveState,
  upsertDiscoveredVenue,
} from '../src/state.js';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { force: true, recursive: true });
    tempDir = undefined;
  }
});

describe('state helpers', () => {
  it('deduplicates discovered venues by url', () => {
    const state = createInitialState();

    upsertDiscoveredVenue(state, { name: 'A', url: 'https://maps.example/a' });
    upsertDiscoveredVenue(state, { name: 'A later', url: 'https://maps.example/a' });

    expect(state.discoveredVenues).toHaveLength(1);
    expect(state.discoveredVenues[0]?.name).toBe('A');
  });

  it('marks completed venues and advances the cursor', () => {
    const state = createInitialState();
    upsertDiscoveredVenue(state, { name: 'A', url: 'https://maps.example/a' });

    markVenueCompleted(state, 'https://maps.example/a');

    expect(state.completedUrls).toContain('https://maps.example/a');
    expect(state.cursor).toBe(1);
  });

  it('removes a venue from failed urls after it later completes', () => {
    const state = createInitialState();
    upsertDiscoveredVenue(state, { name: 'A', url: 'https://maps.example/a' });
    markVenueFailed(state, 'https://maps.example/a');

    markVenueCompleted(state, 'https://maps.example/a');

    expect(state.failedUrls).not.toContain('https://maps.example/a');
  });

  it('loads an existing state file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-state-'));
    const statePath = join(tempDir, 'state.json');
    const first = await loadOrCreateState(statePath);
    upsertDiscoveredVenue(first, { name: 'A', url: 'https://maps.example/a' });
    await saveState(statePath, first);

    const second = await loadOrCreateState(statePath);

    expect(second.discoveredVenues).toEqual([
      { name: 'A', url: 'https://maps.example/a' },
    ]);
  });
});
