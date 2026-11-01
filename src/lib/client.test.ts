import { describe, expect, it } from 'vitest';
import { explain, OverfinError } from './client';
import { i18n } from './i18n.svelte';

// A pin-locked problem as Overfin sends it, with retryAfter when the lock
// ends by itself.
const locked = (retryAfter?: number) =>
  new OverfinError(403, { type: 'pin-locked', title: 'Too many wrong PINs; try again later', status: 403, retryAfter });

describe('explain', () => {
  // A PIN lock that ends by itself says when; one that doesn't sends to the
  // account owner.
  it('says how long a PIN lock lasts, in minutes', () => {
    i18n.set('en');
    expect(explain(locked(900))).toBe('Too many wrong PINs. Try again in 15 min.');
    expect(explain(locked(61))).toBe('Too many wrong PINs. Try again in 2 min.');
    expect(explain(locked())).toBe('Too many wrong PINs. Ask the account owner.');
    i18n.set('fr');
    expect(explain(locked(900))).toBe('Trop de codes incorrects. Réessayez dans 15 min.');
  });
});
