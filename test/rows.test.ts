import { describe, expect, it } from 'vitest';
import { reconcileStateWithRows, shouldRefetchScrapedRow, upsertScrapedRow } from '../src/mapsScraper.js';
import type { ScrapedVenue } from '../src/types.js';

const baseRow: ScrapedVenue = {
  venueType: 'restaurant',
  name: 'Da Verdi',
  url: 'https://maps.example/da-verdi',
  totalReviews: null,
  deletedReviewsMin: 0,
  deletedReviewsMax: 0,
  deletedReviewsEstimate: 0,
  currentStarRating: null,
  percentageDeleted: null,
  realScoreIfDeletedAreOneStar: null,
  deletedReviewNotice: null,
  scrapedAt: '2026-04-25T17:00:00.000Z',
  status: 'failed',
  error: 'browser closed',
};

describe('upsertScrapedRow', () => {
  it('replaces an existing failed row with a successful retry', () => {
    const rows = [baseRow];

    upsertScrapedRow(rows, {
      ...baseRow,
      totalReviews: 200,
      status: 'ok',
      error: undefined,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('ok');
    expect(rows[0]?.totalReviews).toBe(200);
    expect(rows[0]?.error).toBeUndefined();
  });
});

describe('shouldRefetchScrapedRow', () => {
  it('refetches rows with impossible star ratings', () => {
    expect(shouldRefetchScrapedRow({ ...baseRow, currentStarRating: 5.1 })).toBe(true);
  });

  it('refetches rows with zero total reviews', () => {
    expect(shouldRefetchScrapedRow({ ...baseRow, totalReviews: 0 })).toBe(true);
  });

  it('keeps plausible rows', () => {
    expect(
      shouldRefetchScrapedRow({
        ...baseRow,
        totalReviews: 120,
        currentStarRating: 4.7,
        status: 'ok',
      }),
    ).toBe(false);
  });
});

describe('reconcileStateWithRows', () => {
  it('removes completed urls that are missing from the CSV rows and rewinds cursor', () => {
    const state = {
      runKey: 'bonn::germany::hotel',
      discoveredVenues: [
        { name: 'A', url: 'https://maps.example/a' },
        { name: 'B', url: 'https://maps.example/b' },
      ],
      completedUrls: ['https://maps.example/a', 'https://maps.example/b'],
      failedUrls: [],
      cursor: 2,
      updatedAt: '2026-04-25T17:00:00.000Z',
    };

    reconcileStateWithRows(state, [{ ...baseRow, url: 'https://maps.example/a' }]);

    expect(state.completedUrls).toEqual(['https://maps.example/a']);
    expect(state.cursor).toBe(1);
  });
});
