import { describe, expect, it } from 'vitest';
import { i18n } from './i18n.svelte';
import { leavingText } from './leaving';

const now = Date.parse('2026-11-15T12:00:00Z');
const at = (ms: number) => new Date(now + ms).toISOString();
const hour = 3_600_000;
const day = 24 * hour;

describe('leavingText', () => {
  it('says days, then hours under a day, then less than an hour', () => {
    i18n.set('en');
    expect(leavingText(at(7 * day - 60_000), 'movie', now)).toBe('Leaving in 7 days');
    expect(leavingText(at(30 * hour), 'movie', now)).toBe('Leaving in 1 day');
    expect(leavingText(at(5 * hour + 10 * 60_000), 'series', now)).toBe('Leaving in 5 hours');
    expect(leavingText(at(hour + 60_000), 'season', now)).toBe('Leaving in 1 hour');
    expect(leavingText(at(20 * 60_000), 'movie', now)).toBe('Leaving in less than an hour');
  });
  it('says nothing without a date, or once it has passed', () => {
    expect(leavingText(undefined, 'movie', now)).toBe('');
    expect(leavingText(at(-60_000), 'movie', now)).toBe('');
  });
  it('agrees with the title in French', () => {
    i18n.set('fr');
    expect(leavingText(at(3 * day), 'movie', now)).toBe('Retiré dans 3 jours');
    expect(leavingText(at(3 * day), 'series', now)).toBe('Retirée dans 3 jours');
    expect(leavingText(at(2 * hour), 'season', now)).toBe('Retirée dans 2 heures');
    expect(leavingText(at(10 * 60_000), 'movie', now)).toBe('Retiré dans moins d’une heure');
    i18n.set('en');
  });
});
