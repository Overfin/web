import { describe, expect, it } from 'vitest';
import { looksLikeId, searchPath, searchWords } from './searchwords';

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
  it('tell an ID, or a link to one, from words', () => {
    for (const id of ['imdb:tt0133093', ' IMDB: tt01', 'tmdb:', 'tmdb:6', 'tvdb:81189', 'tt0133093', 'TT0', 'imdb.com/title/tt0133093',
      'https://www.themoviedb.org/movie/603-the-matrix', 'https://thetvdb.com/series/breaking-bad', 'm.imdb.com']) {
      expect(looksLikeId(id), id).toBe(true);
    }
    for (const words of ['matrix', 'tt', 'ttyl', 'star trek: picard', 'https://example.org/imdb.com', 'notimdb.com/title/tt0133093', '603']) {
      expect(looksLikeId(words), words).toBe(false);
    }
  });
});
