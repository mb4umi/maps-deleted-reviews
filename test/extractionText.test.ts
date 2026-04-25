import { describe, expect, it } from 'vitest';
import { combineExtractionText } from '../src/mapsScraper.js';

describe('combineExtractionText', () => {
  it('includes aria labels because Google Maps often stores ratings there', () => {
    expect(
      combineExtractionText('Da Verdi 212 Rezensionen', ['4,4 Sterne', 'Route']),
    ).toContain('4,4 Sterne');
  });

  it('deduplicates repeated text fragments', () => {
    expect(combineExtractionText('4,4 Sterne', ['4,4 Sterne'])).toBe('4,4 Sterne');
  });
});
