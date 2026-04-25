import type { DeletedReviews } from './types.js';

const DELETED_REVIEW_RANGE =
  /(\d[\d.\s]*)\s+bis\s+(\d[\d.\s]*)\s+Bewertung(?:en)?\s+aufgrund\s+von\s+Beschwerden\s+wegen\s+Diffamierung\s+entfernt\.?/i;
const DELETED_REVIEW_SINGLE =
  /(\d[\d.\s]*)\s+Bewertung(?:en)?\s+aufgrund\s+von\s+Beschwerden\s+wegen\s+Diffamierung\s+entfernt\.?/i;
const REVIEW_COUNT = /(\d[\d.\s]*)\s+Rezension(?:en)?/i;
const STAR_RATING = /(\d(?:[,.]\d)?)\s+Sterne?/i;

export function parseDeletedReviews(text: string): DeletedReviews | null {
  const normalized = normalizeWhitespace(text);
  const rangeMatch = normalized.match(DELETED_REVIEW_RANGE);
  if (rangeMatch) {
    const min = parseInteger(rangeMatch[1]);
    const max = parseInteger(rangeMatch[2]);

    return {
      min,
      max,
      estimate: roundTo(max === min ? min : (min + max) / 2, 4),
      rawText: rangeMatch[0],
    };
  }

  const singleMatch = normalized.match(DELETED_REVIEW_SINGLE);
  if (!singleMatch) {
    return null;
  }

  const count = parseInteger(singleMatch[1]);
  return {
    min: count,
    max: count,
    estimate: count,
    rawText: singleMatch[0],
  };
}

export function parseReviewCount(text: string): number | null {
  const match = normalizeWhitespace(text).match(REVIEW_COUNT);
  return match ? parseInteger(match[1]) : null;
}

export function parseStarRating(text: string): number | null {
  const match = normalizeWhitespace(text).match(STAR_RATING);
  return match ? Number.parseFloat(match[1].replace(',', '.')) : null;
}

export function calculateMetrics({
  rating,
  visibleReviews,
  deletedReviewsEstimate,
}: {
  rating: number | null;
  visibleReviews: number | null;
  deletedReviewsEstimate: number;
}): {
  percentageDeleted: number | null;
  realScoreIfDeletedAreOneStar: number | null;
} {
  if (rating === null || visibleReviews === null) {
    return {
      percentageDeleted: null,
      realScoreIfDeletedAreOneStar: null,
    };
  }

  const adjustedTotal = visibleReviews + deletedReviewsEstimate;
  if (adjustedTotal === 0) {
    return {
      percentageDeleted: null,
      realScoreIfDeletedAreOneStar: null,
    };
  }

  return {
    percentageDeleted: roundTo(deletedReviewsEstimate / adjustedTotal, 4),
    realScoreIfDeletedAreOneStar: roundTo(
      (rating * visibleReviews + deletedReviewsEstimate) / adjustedTotal,
      4,
    ),
  };
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseInteger(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  return Number.parseInt(value.replace(/[.\s]/g, ''), 10);
}

function roundTo(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
