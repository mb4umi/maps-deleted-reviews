import { describe, expect, it } from 'vitest';
import { detectBlockerKind, detectBlockerText, shouldStartFreshRun } from '../src/mapsScraper.js';
import type { ScrapedVenue, ScraperState } from '../src/types.js';

describe('detectBlockerText', () => {
  it('does not treat the normal Google Maps sign-in button as a blocker', () => {
    expect(
      detectBlockerText('Google Maps Restaurants Bonn Anmelden Weiter Route Speichern'),
    ).toBeNull();
  });

  it('detects unusual traffic challenges', () => {
    expect(
      detectBlockerText('Unsere Systeme haben ungewöhnlichen Traffic aus Ihrem Computernetzwerk festgestellt.'),
    ).toBe('Google appears to be throttling or challenging the session');
  });

  it('classifies unusual traffic challenges as rate limits', () => {
    expect(detectBlockerKind('unusual traffic captcha')).toBe('rate-limit');
  });
});

const completedState: ScraperState = {
  runKey: 'berlin::germany::doner',
  discoveredVenues: [
    { name: 'A', url: 'https://maps.example/a' },
    { name: 'B', url: 'https://maps.example/b' },
  ],
  completedUrls: ['https://maps.example/a', 'https://maps.example/b'],
  failedUrls: [],
  cursor: 2,
  updatedAt: '2026-04-26T07:00:00.000Z',
};

const rows: ScrapedVenue[] = completedState.discoveredVenues.map((venue) => ({
  ...venue,
  venueType: 'Döner',
  totalReviews: 100,
  deletedReviewsMin: 0,
  deletedReviewsMax: 0,
  deletedReviewsEstimate: 0,
  currentStarRating: 4.5,
  percentageDeleted: 0,
  realScoreIfDeletedAreOneStar: 4.5,
  deletedReviewNotice: null,
  scrapedAt: '2026-04-26T07:00:00.000Z',
  status: 'ok',
}));

describe('shouldStartFreshRun', () => {
  it('starts fresh when the requested run is already fully completed', () => {
    expect(shouldStartFreshRun(completedState, rows, 2)).toBe(true);
  });

  it('keeps resumable state when the requested run is incomplete', () => {
    expect(
      shouldStartFreshRun(
        {
          ...completedState,
          completedUrls: ['https://maps.example/a'],
          cursor: 1,
        },
        rows,
        2,
      ),
    ).toBe(false);
  });
});
