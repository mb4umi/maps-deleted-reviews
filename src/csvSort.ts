#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ScrapedVenue } from './types.js';

export function sortScrapedRows(rows: ScrapedVenue[]): ScrapedVenue[] {
  return [...rows].sort((left, right) =>
    compareNullableNumbersDesc(left.percentageDeleted, right.percentageDeleted) ||
    left.name.localeCompare(right.name, 'de', { sensitivity: 'base' }) ||
    compareNullableNumbersDesc(left.deletedReviewsMax, right.deletedReviewsMax),
  );
}

export async function sortCsvFile(path: string): Promise<void> {
  const raw = await readFile(path, 'utf8');
  const sorted = sortCsvText(raw);
  await writeFile(path, sorted, 'utf8');
}

export async function mergeCsvFiles(outputPath: string, inputPaths: string[]): Promise<void> {
  const merged = await mergeCsvTexts(
    await Promise.all(inputPaths.map((path) => readFile(path, 'utf8'))),
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, merged, 'utf8');
}

export async function mergeCsvTexts(rawFiles: string[]): Promise<string> {
  let headerLine = '';
  const rowsByVenueName = new Map<string, string>();

  for (const raw of rawFiles) {
    const [currentHeaderLine, ...rowLines] = raw.trim().split('\n');
    if (!currentHeaderLine) {
      continue;
    }

    headerLine ||= currentHeaderLine;
    const headers = parseCsvLine(currentHeaderLine);
    const nameIndex = headers.indexOf('name');
    for (const rowLine of rowLines.filter(Boolean)) {
      const cells = parseCsvLine(rowLine);
      const nameKey = normalizeVenueName(cells[nameIndex] ?? '');
      if (nameKey && !rowsByVenueName.has(nameKey)) {
        rowsByVenueName.set(nameKey, rowLine);
      }
    }
  }

  return headerLine ? `${[headerLine, ...rowsByVenueName.values()].join('\n')}\n` : '';
}

export function sortCsvText(raw: string): string {
  const [headerLine, ...rowLines] = raw.trim().split('\n');
  if (!headerLine) {
    return raw;
  }

  const headers = parseCsvLine(headerLine);
  const rows = rowLines.filter(Boolean).map((line) => ({
    line,
    cells: parseCsvLine(line),
  }));

  const indexOf = (header: string): number => headers.indexOf(header);
  const percentageIndex = indexOf('percentage_deleted');
  const nameIndex = indexOf('name');
  const deletedMaxIndex = indexOf('deleted_reviews_max');

  rows.sort((left, right) =>
    compareNullableNumbersDesc(
      parseNullableNumber(left.cells[percentageIndex]),
      parseNullableNumber(right.cells[percentageIndex]),
    ) ||
    (left.cells[nameIndex] ?? '').localeCompare(right.cells[nameIndex] ?? '', 'de', {
      sensitivity: 'base',
    }) ||
    compareNullableNumbersDesc(
      parseNullableNumber(left.cells[deletedMaxIndex]),
      parseNullableNumber(right.cells[deletedMaxIndex]),
    ),
  );

  return `${[headerLine, ...rows.map((row) => row.line)].join('\n')}\n`;
}

function compareNullableNumbersDesc(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }

  return right - left;
}

function parseNullableNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeVenueName(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

if (process.argv[1]?.endsWith('csvSort.ts') || process.argv[1]?.endsWith('csvSort.js')) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error('Usage: npm run sort-csv -- <file.csv> [more-files.csv]');
    process.exitCode = 1;
  } else {
    for (const path of paths) {
      await sortCsvFile(path);
      console.log(`Sorted ${path}`);
    }
  }
}
