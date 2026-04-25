import { describe, expect, it } from 'vitest';
import {
  calculateMetrics,
  parseDeletedReviews,
  parseReviewCount,
  parseStarRating,
} from '../src/parsers.js';

describe('parseDeletedReviews', () => {
  it('parses deleted review ranges from German Maps text', () => {
    const text =
      '10 bis 20 Bewertungen aufgrund von Beschwerden wegen Diffamierung entfernt.';

    expect(parseDeletedReviews(text)).toEqual({
      min: 10,
      max: 20,
      estimate: 15,
      rawText: text,
    });
  });

  it('parses single deleted review counts when Maps does not show a range', () => {
    const text =
      '1 Bewertung aufgrund von Beschwerden wegen Diffamierung entfernt.';

    expect(parseDeletedReviews(text)).toEqual({
      min: 1,
      max: 1,
      estimate: 1,
      rawText: text,
    });
  });

  it('returns null when no deleted-review notice is present', () => {
    expect(parseDeletedReviews('Keine passende Meldung')).toBeNull();
  });
});

describe('parseReviewCount', () => {
  it('parses German review counts with thousands separators', () => {
    expect(parseReviewCount('4,5 Sterne 1.234 Rezensionen')).toBe(1234);
  });

  it('parses singular German review count text', () => {
    expect(parseReviewCount('1 Rezension')).toBe(1);
  });
});

describe('parseStarRating', () => {
  it('parses German decimal star ratings', () => {
    expect(parseStarRating('4,3 Sterne')).toBe(4.3);
  });

  it('parses compact Google Maps rating text before review counts', () => {
    expect(parseStarRating('Da Verdi 4,4 (212) Rezensionen')).toBe(4.4);
  });

  it('ignores non-rating numbers', () => {
    expect(parseStarRating('Geöffnet bis 23:00')).toBeNull();
  });
});

describe('calculateMetrics', () => {
  it('calculates deletion percentage and real score with deleted reviews as one star', () => {
    expect(
      calculateMetrics({
        rating: 4.5,
        visibleReviews: 100,
        deletedReviewsEstimate: 10,
      }),
    ).toEqual({
      percentageDeleted: 0.0909,
      realScoreIfDeletedAreOneStar: 4.1818,
    });
  });

  it('returns null metrics when required values are missing', () => {
    expect(
      calculateMetrics({
        rating: null,
        visibleReviews: 100,
        deletedReviewsEstimate: 10,
      }),
    ).toEqual({
      percentageDeleted: null,
      realScoreIfDeletedAreOneStar: null,
    });
  });
});
