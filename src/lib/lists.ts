// A library's or a category's list: what it asks the server for, and the
// key it's kept under for the tab (pagecache). Used by the list page, and
// ahead of it by the main pages' warming (warm.ts).

import type { TitlePage, TitleQuery, TitleSummary } from './sdk/overfin.js';

/** ListKept is what's kept of a list: what was read of it, and how to read
 * on. */
export type ListKept = { items: TitleSummary[]; total?: number; finished: boolean; pages?: AsyncGenerator<TitlePage> };

/** listSorts are the ways a list can be sorted. */
export const listSorts = ['name', 'addedAt', 'premiereDate', 'communityRating', 'lastPlayed', 'random'] as const;

/** listSort is value when it's one of them, else by name. */
export function listSort(value: string | null | undefined): NonNullable<TitleQuery['sort']> {
  return listSorts.includes(value as typeof listSorts[number]) ? value as typeof listSorts[number] : 'name';
}

// Which titles a library lists, by its kind: films or series.
const kinds: Record<string, 'movie' | 'series'> = { movies: 'movie', shows: 'series' };

/** ListChoices are the person's choices on a list (all but the sort as
 * they're in the address). */
export interface ListChoices {
  sort: NonNullable<TitleQuery['sort']>;
  seed?: string;
  genre?: string;
  show?: string;
  yearFrom?: number;
  yearTo?: number;
}

/** listQuery is what a list asks for: a category (films and series alike)
 * or a library (its kind of titles), as the person chose. */
export function listQuery(id: string, category: boolean, libraryKind: string | undefined, c: ListChoices): TitleQuery {
  return {
    ...(category ? { category: id, kind: ['movie', 'series'] as ('movie' | 'series')[] }
      : { library: id, kind: libraryKind ? kinds[libraryKind] : undefined }),
    sort: c.sort,
    limit: 60,
    order: ['addedAt', 'premiereDate', 'communityRating', 'lastPlayed'].includes(c.sort) ? 'desc' : undefined,
    seed: c.sort === 'random' ? c.seed : undefined,
    genre: c.genre || undefined,
    yearFrom: c.yearFrom,
    yearTo: c.yearTo,
    ...({ unwatched: { played: false }, watched: { played: true }, inProgress: { inProgress: true }, favorites: { favorite: true } } as Record<string, TitleQuery>)[c.show ?? 'all'],
  };
}

/** listKey is the key a list is kept under: the sort it was read in is
 * part of it (without one in the address, it's the one the profile last
 * chose, which may have changed since), and a shuffle's seed (one without
 * is a new shuffle). */
export function listKey(profile: string | undefined, base: string, params: URLSearchParams, sort: string, shuffle: string): string {
  const p = new URLSearchParams(params);
  p.delete('seed');
  p.set('sort', sort);
  if (sort === 'random') p.set('seed', shuffle);
  return `${profile}:${base}?${p}`;
}
