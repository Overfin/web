import { describe, expect, it } from 'vitest';
import { listKey, listQuery, listSort } from './lists';

describe('listSort', () => {
  it('keeps a known sort, falls back to by name', () => {
    expect(listSort('addedAt')).toBe('addedAt');
    expect(listSort('random')).toBe('random');
    expect(listSort('nonsense')).toBe('name');
    expect(listSort(null)).toBe('name');
    expect(listSort(undefined)).toBe('name');
  });
});

describe('listQuery', () => {
  it('a library lists its kind; a category, films and series', () => {
    expect(listQuery('lib1', false, 'movies', { sort: 'name' })).toMatchObject({ library: 'lib1', kind: 'movie', limit: 60 });
    expect(listQuery('lib2', false, 'shows', { sort: 'name' })).toMatchObject({ library: 'lib2', kind: 'series' });
    expect(listQuery('lib3', false, undefined, { sort: 'name' }).kind).toBeUndefined();
    expect(listQuery('cat1', true, 'movies', { sort: 'name' })).toMatchObject({ category: 'cat1', kind: ['movie', 'series'] });
  });
  it('newest first for dates and ratings, a seed only for a shuffle', () => {
    expect(listQuery('l', false, 'movies', { sort: 'addedAt' }).order).toBe('desc');
    expect(listQuery('l', false, 'movies', { sort: 'communityRating' }).order).toBe('desc');
    expect(listQuery('l', false, 'movies', { sort: 'name' }).order).toBeUndefined();
    expect(listQuery('l', false, 'movies', { sort: 'random', seed: '42' }).seed).toBe('42');
    expect(listQuery('l', false, 'movies', { sort: 'name', seed: '42' }).seed).toBeUndefined();
  });
  it('what to show becomes its filter; "all" and an empty genre filter nothing', () => {
    expect(listQuery('l', false, 'movies', { sort: 'name', show: 'unwatched' }).played).toBe(false);
    expect(listQuery('l', false, 'movies', { sort: 'name', show: 'watched' }).played).toBe(true);
    expect(listQuery('l', false, 'movies', { sort: 'name', show: 'inProgress' }).inProgress).toBe(true);
    expect(listQuery('l', false, 'movies', { sort: 'name', show: 'favorites' }).favorite).toBe(true);
    const all = listQuery('l', false, 'movies', { sort: 'name', show: 'all', genre: '' });
    expect(all.played).toBeUndefined();
    expect(all.genre).toBeUndefined();
  });
});

describe('listKey', () => {
  it('keeps the sort read, and the seed for a shuffle only', () => {
    const params = new URLSearchParams('genre=Drama&seed=old');
    expect(listKey('p1', '/films', params, 'name', 's')).toBe('p1:/films?genre=Drama&sort=name');
    expect(listKey('p1', '/films', params, 'random', 'new')).toBe('p1:/films?genre=Drama&sort=random&seed=new');
    // A profile's list isn't another's.
    expect(listKey('p2', '/films', params, 'name', 's')).not.toBe(listKey('p1', '/films', params, 'name', 's'));
    // The address's own parameters are left as they were.
    expect(params.get('seed')).toBe('old');
  });
});
