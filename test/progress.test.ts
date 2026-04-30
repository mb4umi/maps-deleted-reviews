import { describe, expect, it } from 'vitest';
import { formatVenueProgress, formatVenuesDetected } from '../src/progress.js';
import type { ScrapedVenue } from '../src/types.js';

const row: ScrapedVenue = {
  venueType: 'Döner',
  name: 'Rüyam Gemüse Kebab 2',
  url: 'https://maps.example/rueyam',
  totalReviews: 42_291,
  deletedReviewsMin: 11,
  deletedReviewsMax: 20,
  deletedReviewsEstimate: 15.5,
  currentStarRating: 4.9,
  percentageDeleted: 0.0004,
  realScoreIfDeletedAreOneStar: 4.8986,
  deletedReviewNotice: '11 bis 20 Bewertungen aufgrund von Beschwerden wegen Diffamierung entfernt.',
  scrapedAt: '2026-04-30T09:00:00.000Z',
  status: 'ok',
};

describe('progress formatting', () => {
  it('formats detected venue counts', () => {
    expect(formatVenuesDetected(17)).toBe('Venues detected: 17');
  });

  it('formats venue rows as aligned terminal output', () => {
    expect(formatVenueProgress(row)).toContain('Venue Rüyam Gemüse Kebab 2');
    expect(formatVenueProgress(row)).toContain('⎸ 11 to 20 deletions');
    expect(formatVenueProgress(row)).toContain('⎸ 42291 total reviews');
  });
});
