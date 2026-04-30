import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../src/cli.js';

describe('parseCliArgs', () => {
  it('parses config path and single-search overrides', () => {
    expect(
      parseCliArgs([
        '--config',
        'custom.json',
        '--city',
        'Köln',
        '--country',
        'Germany',
        '--search-term',
        'Hotel',
        '--depth',
        '100',
        '--headless',
        '--no-sort-csv',
      ]),
    ).toEqual({
      configPath: 'custom.json',
      overrides: {
        city: 'Köln',
        country: 'Germany',
        searchTerm: 'Hotel',
        depth: 100,
        headed: false,
        sortCsv: false,
      },
    });
  });

  it('parses the CSV sorting flag', () => {
    expect(parseCliArgs(['--sort-csv']).overrides.sortCsv).toBe(true);
    expect(parseCliArgs(['--no-sort-csv']).overrides.sortCsv).toBe(false);
  });

  it('parses the merged CSV output path', () => {
    expect(parseCliArgs(['--merge-csv-path', 'output/merged.csv']).overrides.mergeCsvPath).toBe(
      'output/merged.csv',
    );
    expect(parseCliArgs(['--merged-output-csv', 'output/all.csv']).overrides.mergeCsvPath).toBe(
      'output/all.csv',
    );
  });

  it('parses comma-separated batch search terms', () => {
    expect(parseCliArgs(['--search-terms', 'restaurant, Cafe,Hotel']).overrides.searchTerms).toEqual([
      'restaurant',
      'Cafe',
      'Hotel',
    ]);
  });

  it('parses comma-separated batch cities', () => {
    expect(parseCliArgs(['--cities', 'Bonn, Köln,Düsseldorf']).overrides.cities).toEqual([
      'Bonn',
      'Köln',
      'Düsseldorf',
    ]);
  });

  it('throws on missing flag values', () => {
    expect(() => parseCliArgs(['--city'])).toThrow(/Missing value/);
  });
});
