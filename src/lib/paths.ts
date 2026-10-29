// Readable addresses: /title/m550988/free-guy, /title/s38527/19-2/season-1/
// episode-3, /person/1245/scarlett-johansson, /collection/645/james-bond,
// /category/films. Only the number counts (m: a film, s: a series, as TMDB
// numbers them apart); the name after it is decoration, as the person sees
// it, and is put right when it's wrong or missing. The API's IDs stay as
// they are, and addresses made of them (/title/title_movie_tmdb_550988)
// still work.

import type { Category } from './sdk/overfin.js';

/** slug is a name as an address's part: lowercase letters and digits,
 * accents dropped, the rest dashes; "" for a name without any. */
export function slug(name: string | undefined): string {
  const s = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= 60) return s;
  // Long: cut at a word's end.
  const cut = s.slice(0, 60);
  return cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut;
}

const titleId = /^title_(movie|series)_tmdb_(\d+)(?:_s(\d+)(?:_e(\d+))?)?$/;

/** titlePath is a title's address; name is its own, or its series' for a
 * season or an episode. A title TMDB doesn't know keeps its ID. */
export function titlePath(id: string, name?: string): string {
  const m = titleId.exec(id);
  if (!m) return `/title/${encodeURIComponent(id)}`;
  const parts = [`${m[1] === 'movie' ? 'm' : 's'}${m[2]}`];
  const s = slug(name);
  if (s) parts.push(s);
  if (m[3] !== undefined) parts.push(`season-${m[3]}`);
  if (m[4] !== undefined) parts.push(`episode-${m[4]}`);
  return `/title/${parts.join('/')}`;
}

/** titlePathOf is a title's address, from what lists and pages carry. */
export function titlePathOf(t: { id: string; name: string; series?: { name: string } }): string {
  return titlePath(t.id, t.series?.name ?? t.name);
}

/** titleIdOf reads a title's ID from its address's parts after /title/;
 * null when they name none. */
export function titleIdOf(parts: string[]): string | null {
  const [first, ...rest] = parts;
  if (!first) return null;
  if (first.startsWith('title_')) return first;
  const m = /^([ms])([1-9]\d{0,9})$/.exec(first);
  if (!m) return null;
  let id = `title_${m[1] === 'm' ? 'movie' : 'series'}_tmdb_${m[2]}`;
  if (m[1] === 's') {
    const season = rest.map((p) => /^season-(\d{1,4})$/.exec(p)?.[1]).find(Boolean);
    const episode = rest.map((p) => /^episode-(\d{1,5})$/.exec(p)?.[1]).find(Boolean);
    if (season !== undefined) {
      id += `_s${Number(season)}`;
      if (episode !== undefined) id += `_e${Number(episode)}`;
    }
  }
  return id;
}

/** personPath is a person's address. */
export function personPath(id: string, name?: string): string {
  const m = /^person_tmdb_(\d+)$/.exec(id);
  if (!m) return `/person/${encodeURIComponent(id)}`;
  const s = slug(name);
  return `/person/${m[1]}${s ? `/${s}` : ''}`;
}

/** personIdOf reads a person's ID from the part after /person/. */
export function personIdOf(part: string | undefined): string | null {
  if (!part) return null;
  return /^\d{1,10}$/.test(part) ? `person_tmdb_${part}` : part;
}

/** collectionPath is a collection's address. */
export function collectionPath(id: string, name?: string): string {
  const m = /^collection_(\d+)$/.exec(id);
  if (!m) return `/collection/${encodeURIComponent(id)}`;
  const s = slug(name);
  return `/collection/${m[1]}${s ? `/${s}` : ''}`;
}

/** collectionIdOf reads a collection's ID from the part after
 * /collection/. */
export function collectionIdOf(part: string | undefined): string | null {
  if (!part) return null;
  return /^\d{1,10}$/.test(part) ? `collection_${part}` : part;
}

/** categoryPath is a category's address: its name, as the profile sees
 * it; its ID when another category has the same. */
export function categoryPath(c: Category, all: Category[]): string {
  const s = slug(c.name);
  const shared = !s || all.some((x) => x.id !== c.id && slug(x.name) === s);
  return `/category/${shared ? encodeURIComponent(c.id) : s}`;
}

/** categoryIdOf finds a category by the part after /category/: its ID,
 * or its name's slug. */
export function categoryIdOf(part: string | undefined, all: Category[]): string | null {
  if (!part) return null;
  if (all.some((c) => c.id === part)) return part;
  const named = all.filter((c) => slug(c.name) === part);
  return named.length === 1 ? named[0].id : part;
}

/** correct puts the address right (the name after the number), without a
 * new history entry nor showing the page again: only while the address
 * still names the same thing (still names, for its parts after the first,
 * says what they name). */
export function correct(path: string, still: (parts: string[]) => boolean) {
  if (location.pathname === path) return;
  const parts = location.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts[0] !== path.split('/')[1] || !still(parts.slice(1))) return;
  history.replaceState(history.state, '', path + location.search + location.hash);
}
