import type { DeletedReviews } from './types.js';

const DELETED_REVIEW_RANGE =
  /([\d.\s]+|ein(?:e|en|er|es|s)?|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn)\s+bis\s+([\d.\s]+|ein(?:e|en|er|es|s)?|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn)\s+Bewertung(?:en)?\s+aufgrund\s+von\s+Beschwerden\s+wegen\s+Diffamierung\s+entfernt\.?/i;
const DELETED_REVIEW_SINGLE =
  /([\d.\s]+|ein(?:e|en|er|es|s)?|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn)\s+Bewertung(?:en)?\s+aufgrund\s+von\s+Beschwerden\s+wegen\s+Diffamierung\s+entfernt\.?/i;
const REVIEW_COUNT = /(\d[\d.\s]*)\s+Rezension(?:en)?/i;
const STAR_RATING = /(\d(?:[,.]\d)?)\s+Sterne?/i;
const COMPACT_STAR_RATING = /\b([1-5][,.]\d)\s+\(?\d[\d.\s]*\)?\s+Rezension(?:en)?/i;

export function parseDeletedReviews(text: string): DeletedReviews | null {
  const normalized = normalizeWhitespace(text);
  const rangeMatch = normalized.match(DELETED_REVIEW_RANGE);
  if (rangeMatch) {
    const min = parseCount(rangeMatch[1]);
    const max = parseCount(rangeMatch[2]);

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

  const count = parseCount(singleMatch[1]);
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
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(STAR_RATING) ?? normalized.match(COMPACT_STAR_RATING);
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

function parseCount(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const normalized = value.toLowerCase().trim();
  const numberWords: Record<string, number> = {
    ein: 1,
    eine: 1,
    einen: 1,
    einer: 1,
    eines: 1,
    eins: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    fuenf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
    zehn: 10,
  };

  return numberWords[normalized] ?? parseInteger(value);
}

function roundTo(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
