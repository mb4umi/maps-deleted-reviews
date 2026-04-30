import type { ScrapedVenue } from './types.js';

export function formatVenuesDetected(count: number): string {
  return `Venues detected: ${count}`;
}

export function formatVenueProgress(row: ScrapedVenue): string {
  const name = row.name.padEnd(36, ' ');
  const deletions = `${row.deletedReviewsMin} to ${row.deletedReviewsMax} deletions`.padEnd(24, ' ');
  return [
    `Venue ${name}`,
    deletions,
    `${formatTotalReviews(row.totalReviews)} total reviews`,
  ].join(' ⎸ ');
}

function formatTotalReviews(totalReviews: number | null): string {
  return totalReviews === null ? 'unknown' : String(totalReviews);
}
