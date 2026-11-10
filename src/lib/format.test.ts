import { describe, expect, it } from 'vitest';
import { ageText, clock, duration } from './format';
import { date, i18n, num, t, tn, type Key } from './i18n.svelte';

describe('format', () => {
  it('shows positions as a clock', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(125_000)).toBe('2:05');
    expect(clock(3_725_000)).toBe('1:02:05');
  });
  it('shows lengths in words, in the current language', () => {
    i18n.set('en');
    expect(duration(42 * 60_000)).toBe('42 min');
    expect(duration(102 * 60_000)).toBe('1 h 42 min');
  });
  it('shows ages, not ratings', () => {
    i18n.set('fr');
    expect(ageText(0)).toBe('Tous publics');
    expect(ageText(12)).toBe('12+');
    expect(ageText(undefined)).toBe('');
    i18n.set('en');
    expect(ageText(0)).toBe('All ages');
    expect(ageText(16)).toBe('16+');
  });
});

describe('t', () => {
  it('shows a key built from a value it does not know as it is', () => {
    i18n.set('fr');
    expect(t('request.status.deleted' as Key)).toBe('request.status.deleted');
  });
  it('fills in values, and leaves unknown ones visible', () => {
    i18n.set('en');
    expect(t('home.latest', { library: 'Movies' })).toBe('Latest in Movies');
    expect(t('home.latest')).toBe('Latest in {library}');
  });
  it('picks singular and plural forms by language', () => {
    i18n.set('en');
    expect(tn('library.count', 1)).toBe('1 item');
    expect(tn('library.count', 0)).toBe('0 items');
    i18n.set('fr');
    // French counts 0 and 1 as singular.
    expect(tn('library.count', 0)).toBe('0 titre');
    expect(tn('library.count', 2)).toBe('2 titres');
  });
  it("writes dates and numbers in the account's language, not the browser's", () => {
    i18n.follow('fr-CA');
    expect(i18n.formats).toBe('fr-CA');
    expect(date('2011-04-16T12:00:00Z')).toBe(new Date('2011-04-16T12:00:00Z').toLocaleDateString('fr-CA', { dateStyle: 'medium' }));
    expect(date('2011-04-16T12:00:00Z')).toMatch(/avr/);
    expect(num(8.5, { minimumFractionDigits: 1 })).toBe('8,5');
    i18n.follow('en-US');
    expect(num(8.5, { minimumFractionDigits: 1 })).toBe('8.5');
    // A language the site has no texts in: English, and English formats.
    i18n.follow('de-DE');
    expect(i18n.locale).toBe('en');
    expect(i18n.formats).toBe('en');
    i18n.set('en');
  });
});
