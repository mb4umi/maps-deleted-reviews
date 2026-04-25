import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ScrapedVenue } from './types.js';

const CSV_HEADERS = [
  'name',
  'address',
  'url',
  'total_reviews',
  'deleted_reviews_min',
  'deleted_reviews_max',
  'deleted_reviews_estimate',
  'current_star_rating',
  'percentage_deleted',
  'real_score_if_deleted_are_1star',
  'deleted_review_notice',
  'status',
  'error',
  'scraped_at',
];

export async function writeCsv(outputPath: string, rows: ScrapedVenue[]): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const lines = [
    CSV_HEADERS.join(','),
    ...rows.map((row) =>
      [
        row.name,
        row.address ?? '',
        row.url,
        row.totalReviews,
        row.deletedReviewsMin,
        row.deletedReviewsMax,
        row.deletedReviewsEstimate,
        row.currentStarRating,
        row.percentageDeleted,
        row.realScoreIfDeletedAreOneStar,
        row.deletedReviewNotice ?? '',
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
