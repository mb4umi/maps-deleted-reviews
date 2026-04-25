import { describe, expect, it } from 'vitest';
import { upsertScrapedRow } from '../src/mapsScraper.js';
import type { ScrapedVenue } from '../src/types.js';

const baseRow: ScrapedVenue = {
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
