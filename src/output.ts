import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sortScrapedRows } from './csvSort.js';
import type { ScrapedVenue } from './types.js';

const CSV_HEADERS = [
  'venue_type',
  'name',
  'total_reviews',
  'deleted_reviews_min',
  'deleted_reviews_max',
  'percentage_deleted',
  'current_star_rating',
  'real_score',
  'review_notice',
  'url',
  'address',
  'deleted_reviews_estimate',
  'status',
  'error',
  'scraped_at',
];

export async function writeCsv(
  outputPath: string,
  rows: ScrapedVenue[],
  sortCsv = true,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const outputRows = sortCsv ? sortScrapedRows(rows) : rows;
  const lines = [
    CSV_HEADERS.join(','),
    ...outputRows.map((row) =>
      [
        row.venueType,
        row.name,
        row.totalReviews,
        row.deletedReviewsMin,
        row.deletedReviewsMax,
        formatPercent(row.percentageDeleted),
        row.currentStarRating,
        row.realScoreIfDeletedAreOneStar,
        row.deletedReviewNotice ?? '',
        row.url,
        row.address ?? '',
        row.deletedReviewsEstimate,
        row.status,
        row.error ?? '',
        row.scrapedAt,
      ]
        .map(formatCsvCell)
        .join(','),
    ),
  ];

  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function formatCsvCell(value: string | number | null): string {
  if (value === null) {
    return '';
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatPercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return roundTo(value * 100, 4);
}

function roundTo(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
