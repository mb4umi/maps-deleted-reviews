import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mergeCsvFiles, sortCsvFile } from '../src/csvSort.js';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { force: true, recursive: true });
    tempDir = undefined;
  }
});

describe('mergeCsvFiles', () => {
  it('merges generated CSVs and removes duplicate venue names', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-merge-csv-'));
    const firstPath = join(tempDir, 'first.csv');
    const secondPath = join(tempDir, 'second.csv');
    const outputPath = join(tempDir, 'merged.csv');
    const header =
      'venue_type,name,total_reviews,deleted_reviews_min,deleted_reviews_max,percentage_deleted,current_star_rating,real_score,review_notice,url,address,deleted_reviews_estimate,status,error,scraped_at';
    await writeFile(
      firstPath,
      [
        header,
        'Döner,Alpha,100,1,10,10,4.8,4.7,,https://maps.example/a,,5,ok,,2026-04-30T09:00:00.000Z',
        'Döner,Beta,100,1,20,20,4.8,4.7,,https://maps.example/b,,10,ok,,2026-04-30T09:00:00.000Z',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      secondPath,
      [
        header,
        'Kebab, alpha ,120,1,50,30,4.8,4.7,,https://maps.example/a2,,25,ok,,2026-04-30T09:00:00.000Z',
        'Kebab,Gamma,100,1,5,5,4.8,4.7,,https://maps.example/g,,2.5,ok,,2026-04-30T09:00:00.000Z',
        '',
      ].join('\n'),
      'utf8',
    );

    await mergeCsvFiles(outputPath, [firstPath, secondPath]);

    const [, ...rows] = (await readFile(outputPath, 'utf8')).trim().split('\n');
    expect(rows.map((row) => row.split(',')[1])).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

describe('sortCsvFile', () => {
  it('sorts an existing generated CSV in place', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-sort-csv-'));
    const csvPath = join(tempDir, 'legacy.csv');
    await writeFile(
      csvPath,
      [
        'venue_type,name,total_reviews,deleted_reviews_min,deleted_reviews_max,percentage_deleted,current_star_rating,real_score,review_notice,url,address,deleted_reviews_estimate,status,error,scraped_at',
        'Döner,Charlie,100,1,100,5,4.8,4.7,,https://maps.example/c,,50,ok,,2026-04-30T09:00:00.000Z',
        'Döner,Beta,100,1,10,10,4.8,4.7,,https://maps.example/b,,5,ok,,2026-04-30T09:00:00.000Z',
        'Döner,Alpha,100,1,20,10,4.8,4.7,,https://maps.example/a,,10,ok,,2026-04-30T09:00:00.000Z',
        '',
      ].join('\n'),
      'utf8',
    );

    await sortCsvFile(csvPath);

    const [, ...rows] = (await readFile(csvPath, 'utf8')).trim().split('\n');
    expect(rows.map((row) => row.split(',')[1])).toEqual(['Alpha', 'Beta', 'Charlie']);
  });
});
