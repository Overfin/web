// A search's words: in the address (/search?q=…), and kept in the tab for
// the profile searching.

/** searchPath is the search page's address for these words. */
export function searchPath(words: string): string {
  return words ? '/search?' + new URLSearchParams({ q: words }).toString() : '/search';
}

/** searchWords is what the search page starts with: the address's words
 * when it has some, else those kept for this profile, else none. */
export function searchWords(params: URLSearchParams, kept: unknown, profile: string): string {
  const q = params.get('q');
  if (q !== null) return q;
  const k = kept as { profile?: unknown; q?: unknown } | null;
  return k?.profile === profile && typeof k.q === 'string' ? k.q : '';
}

/** looksLikeId says whether words are, or are becoming, a title's ID or a
 * link to one (imdb:…, tmdb:…, tvdb:…, tt0133093, an imdb.com,
 * themoviedb.org or thetvdb.com page), which the server looks up instead
 * of searching words: those aren't searched as one types, only when asked
 * (Enter, a paste, an example), so a half-typed ID doesn't have the
 * server ask TMDB for every one on the way. */
export function looksLikeId(words: string): boolean {
  const s = words.trim().toLowerCase();
  return /^(imdb|tmdb|tvdb)\s*:/.test(s) || /^tt\d/.test(s) ||
    /^(https?:\/\/)?([a-z0-9-]+\.)*(imdb\.com|themoviedb\.org|thetvdb\.com)(\/|$)/.test(s);
}

/** idExamples are the ID forms the empty search page shows, one each. */
export const idExamples = [
  { site: 'IMDb', example: 'tt0133093' },
  { site: 'TMDB', example: 'tmdb:movie/603' },
  { site: 'TheTVDB', example: 'tvdb:81189' },
] as const;
