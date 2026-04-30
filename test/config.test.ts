import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { loadConfigs, normalizeConfig, normalizeConfigs } from '../src/config.js';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { force: true, recursive: true });
    tempDir = undefined;
  }
});

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
      sortCsv: true,
      outputCsvPath: 'output/deleted-reviews-bonn-restaurant.csv',
      summaryPath: 'output/summary-bonn-restaurant.json',
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

  it('allows disabling automatic CSV sorting', () => {
    expect(
      normalizeConfig({
        city: 'Bonn',
        country: 'Germany',
        searchTerm: 'restaurant',
        depth: 25,
        sortCsv: false,
      }).sortCsv,
    ).toBe(false);
  });

  it('preserves a merged CSV path for batch runs', () => {
    const configs = normalizeConfigs({
      city: 'Bonn',
      country: 'Germany',
      searchTerms: ['restaurant', 'Cafe'],
      depth: 10,
      mergeCsvPath: 'output/merged.csv',
    });

    expect(configs.map((config) => config.mergeCsvPath)).toEqual([
      'output/merged.csv',
      'output/merged.csv',
    ]);
  });

  it('slugifies city and search term in the default output path', () => {
    const config = normalizeConfig({
      city: 'München',
      country: 'Germany',
      searchTerm: 'Café & Bar',
      depth: 25,
    });

    expect(config.outputCsvPath).toBe('output/deleted-reviews-munchen-cafe-bar.csv');
    expect(config.summaryPath).toBe('output/summary-munchen-cafe-bar.json');
    expect(config.statePath).toBe('output/state-munchen-cafe-bar.json');
  });

  it('expands searchTerms into multiple configs', () => {
    const configs = normalizeConfigs({
      city: 'Bonn',
      country: 'Germany',
      searchTerms: ['restaurant', 'Cafe'],
      depth: 10,
    });

    expect(configs.map((config) => config.searchTerm)).toEqual(['restaurant', 'Cafe']);
    expect(configs.map((config) => config.outputCsvPath)).toEqual([
      'output/deleted-reviews-bonn-restaurant.csv',
      'output/deleted-reviews-bonn-cafe.csv',
    ]);
  });

  it('expands cities into multiple configs', () => {
    const configs = normalizeConfigs({
      cities: ['Bonn', 'Köln'],
      country: 'Germany',
      searchTerm: 'Hotel',
      depth: 10,
    });

    expect(configs.map((config) => config.city)).toEqual(['Bonn', 'Köln']);
    expect(configs.map((config) => config.outputCsvPath)).toEqual([
      'output/deleted-reviews-bonn-hotel.csv',
      'output/deleted-reviews-koln-hotel.csv',
    ]);
  });

  it('expands cities and searchTerms into all combinations', () => {
    const configs = normalizeConfigs({
      cities: ['Bonn', 'Köln'],
      country: 'Germany',
      searchTerms: ['restaurant', 'Cafe'],
      depth: 10,
    });

    expect(configs.map((config) => `${config.city}:${config.searchTerm}`)).toEqual([
      'Bonn:restaurant',
      'Bonn:Cafe',
      'Köln:restaurant',
      'Köln:Cafe',
    ]);
  });

  it('rejects shared output paths for batch configs', () => {
    expect(() =>
      normalizeConfigs({
        city: 'Bonn',
        country: 'Germany',
        searchTerms: ['restaurant', 'Cafe'],
        depth: 10,
        outputCsvPath: 'output/shared.csv',
      }),
    ).toThrow(/cannot be set when using cities or searchTerms batches/);
  });

  it('lets a CLI searchTerm override a batch config', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-config-'));
    const configPath = join(tempDir, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        city: 'Bonn',
        country: 'Germany',
        searchTerms: ['restaurant', 'Cafe'],
        depth: 10,
      }),
      'utf8',
    );

    const configs = await loadConfigs(configPath, { searchTerm: 'Hotel' });

    expect(configs.map((config) => config.searchTerm)).toEqual(['Hotel']);
  });

  it('lets a CLI city override a batch city config', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'maps-config-'));
    const configPath = join(tempDir, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({
        cities: ['Bonn', 'Köln'],
        country: 'Germany',
        searchTerm: 'Hotel',
        depth: 10,
      }),
      'utf8',
    );

    const configs = await loadConfigs(configPath, { city: 'Düsseldorf' });

    expect(configs.map((config) => config.city)).toEqual(['Düsseldorf']);
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
