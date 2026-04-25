import { describe, expect, it } from 'vitest';
import { detectBlockerKind, detectBlockerText } from '../src/mapsScraper.js';

describe('detectBlockerText', () => {
  it('does not treat the normal Google Maps sign-in button as a blocker', () => {
    expect(
      detectBlockerText('Google Maps Restaurants Bonn Anmelden Weiter Route Speichern'),
    ).toBeNull();
  });

  it('detects unusual traffic challenges', () => {
    expect(
      detectBlockerText('Unsere Systeme haben ungewöhnlichen Traffic aus Ihrem Computernetzwerk festgestellt.'),
    ).toBe('Google appears to be throttling or challenging the session');
  });

  it('classifies unusual traffic challenges as rate limits', () => {
    expect(detectBlockerKind('unusual traffic captcha')).toBe('rate-limit');
  });
});
