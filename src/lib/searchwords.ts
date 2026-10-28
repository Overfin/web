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
