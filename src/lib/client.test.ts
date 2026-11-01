import { describe, expect, it } from 'vitest';
import { explain, OverfinError } from './client';
import { i18n } from './i18n.svelte';

describe('explain', () => {
  // A PIN lock that ends by itself says when; one that doesn't sends to the
  // account owner.
  it('says how long a PIN lock lasts, in minutes', () => {
    i18n.set('en');
    expect(explain(new OverfinError(403, { type: 'pin-locked', retryAfter: 900 }))).toBe('Too many wrong PINs. Try again in 15 min.');
    expect(explain(new OverfinError(403, { type: 'pin-locked', retryAfter: 61 }))).toBe('Too many wrong PINs. Try again in 2 min.');
    expect(explain(new OverfinError(403, { type: 'pin-locked' }))).toBe('Too many wrong PINs. Ask the account owner.');
    i18n.set('fr');
    expect(explain(new OverfinError(403, { type: 'pin-locked', retryAfter: 900 }))).toBe('Trop de codes incorrects. Réessayez dans 15 min.');
  });
});
