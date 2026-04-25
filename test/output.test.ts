import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeCsv } from '../src/output.js';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { force: true, recursive: true });
    tempDir = undefined;
  }
});

describe('writeCsv', () => {
  it('writes a stable CSV header and escapes values', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-csv-'));
    const outputPath = join(tempDir, 'results.csv');

    await writeCsv(outputPath, [
      {
        venueType: 'restaurant',
        name: 'Cafe "Bonn"',
        url: 'https://maps.example/a',
        address: 'Innenstadt, Bonn',
        totalReviews: 100,
        deletedReviewsMin: 10,
        deletedReviewsMax: 20,
        deletedReviewsEstimate: 15,
        currentStarRating: 4.5,
        percentageDeleted: 0.1304,
        realScoreIfDeletedAreOneStar: 4.0435,
        deletedReviewNotice:
          '10 bis 20 Bewertungen aufgrund von Beschwerden wegen Diffamierung entfernt.',
        scrapedAt: '2026-04-25T17:30:00.000Z',
        status: 'ok',
      },
    ]);

    expect(await readFile(outputPath, 'utf8')).toBe(
      [
        'venue_type,name,total_reviews,deleted_reviews_min,deleted_reviews_max,percentage_deleted,current_star_rating,real_score,review_notice,url,address,deleted_reviews_estimate,status,error,scraped_at',
        'restaurant,"Cafe ""Bonn""",100,10,20,13.04,4.5,4.0435,10 bis 20 Bewertungen aufgrund von Beschwerden wegen Diffamierung entfernt.,https://maps.example/a,"Innenstadt, Bonn",15,ok,,2026-04-25T17:30:00.000Z',
        '',
      ].join('\n'),
    );
  });
});
