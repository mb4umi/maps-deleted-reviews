import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../src/config.js';

describe('normalizeConfig', () => {
  it('applies safe defaults around a minimal user config', () => {
    expect(
      normalizeConfig({
        city: 'Bonn',
        country: 'Germany',
        searchTerm: 'restaurant',
        depth: 25,
      }),
    ).toMatchObject({
      city: 'Bonn',
      country: 'Germany',
      searchTerm: 'restaurant',
      depth: 25,
      locale: 'de-DE',
      resumeMode: 'pause',
      headed: true,
      outputCsvPath: 'output/deleted-reviews-bonn-restaurant.csv',
      statePath: 'output/state-bonn-restaurant.json',
    });
  });

  it('preserves an explicit output path when configured', () => {
    expect(
      normalizeConfig({
        city: 'Bonn',
        country: 'Germany',
        searchTerm: 'Café',
        depth: 25,
        outputCsvPath: 'output/custom.csv',
      }).outputCsvPath,
    ).toBe('output/custom.csv');
  });

  it('slugifies city and search term in the default output path', () => {
    const config = normalizeConfig({
      city: 'München',
      country: 'Germany',
      searchTerm: 'Café & Bar',
      depth: 25,
    });

    expect(config.outputCsvPath).toBe('output/deleted-reviews-munchen-cafe-bar.csv');
    expect(config.statePath).toBe('output/state-munchen-cafe-bar.json');
  });

  it('rejects invalid depth and resume mode values', () => {
    expect(() =>
      normalizeConfig({
        city: 'Bonn',
        country: 'Germany',
        searchTerm: 'restaurant',
        depth: 0,
        resumeMode: 'invalid',
      }),
    ).toThrow(/depth.*resumeMode/);
  });
});
