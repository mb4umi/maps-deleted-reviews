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
      ]),
    ).toEqual({
      configPath: 'custom.json',
      overrides: {
        city: 'Köln',
        country: 'Germany',
        searchTerm: 'Hotel',
        depth: 100,
        headed: false,
      },
    });
  });

  it('parses comma-separated batch search terms', () => {
    expect(parseCliArgs(['--search-terms', 'restaurant, Cafe,Hotel']).overrides.searchTerms).toEqual([
      'restaurant',
      'Cafe',
      'Hotel',
    ]);
  });

  it('throws on missing flag values', () => {
    expect(() => parseCliArgs(['--city'])).toThrow(/Missing value/);
  });
});
