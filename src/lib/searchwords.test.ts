import { describe, expect, it } from 'vitest';
import { searchPath, searchWords } from './searchwords';

describe('search words', () => {
  it('go in the address, encoded', () => {
    expect(searchPath('')).toBe('/search');
    expect(searchPath('free guy')).toBe('/search?q=free+guy');
    expect(searchPath('a&b=c')).toBe('/search?q=a%26b%3Dc');
  });
  it('come back from the address', () => {
    const words = 'l’homme & co?';
    const address = new URL(searchPath(words), 'https://example.org');
    expect(searchWords(address.searchParams, null, 'p1')).toBe(words);
  });
  it('take the address over what the tab kept', () => {
    expect(searchWords(new URLSearchParams('q=dune'), { profile: 'p1', q: 'alien' }, 'p1')).toBe('dune');
    // An empty q in the address is an empty search.
    expect(searchWords(new URLSearchParams('q='), { profile: 'p1', q: 'alien' }, 'p1')).toBe('');
  });
  it('use what the tab kept for the same profile only', () => {
    expect(searchWords(new URLSearchParams(), { profile: 'p1', q: 'alien' }, 'p1')).toBe('alien');
    expect(searchWords(new URLSearchParams(), { profile: 'p2', q: 'alien' }, 'p1')).toBe('');
    expect(searchWords(new URLSearchParams(), null, 'p1')).toBe('');
    expect(searchWords(new URLSearchParams(), { profile: 'p1', q: 3 }, 'p1')).toBe('');
  });
});
