import { describe, expect, it } from 'vitest';
import { categoryIdOf, categoryPath, collectionIdOf, collectionPath, personIdOf, personPath, slug, titleIdOf, titlePath } from './paths';

describe('slug', () => {
  it('keeps letters and digits, drops accents, dashes the rest', () => {
    expect(slug("L'homme libre")).toBe('l-homme-libre');
    expect(slug('19-2')).toBe('19-2');
    expect(slug('Amélie & Co.')).toBe('amelie-co');
    expect(slug('  ')).toBe('');
    expect(slug('東京')).toBe('');
    expect(slug('a'.repeat(30) + ' ' + 'b'.repeat(40)).length).toBeLessThanOrEqual(60);
  });
});

describe('titles', () => {
  it('reads and writes films, series, seasons and episodes', () => {
    expect(titlePath('title_movie_tmdb_550988', 'Free Guy')).toBe('/title/m550988/free-guy');
    expect(titlePath('title_series_tmdb_38527_s1_e3', '19-2')).toBe('/title/s38527/19-2/season-1/episode-3');
    expect(titlePath('title_series_tmdb_38527_s2')).toBe('/title/s38527/season-2');
    expect(titlePath('title_item_0123abc', 'x')).toBe('/title/title_item_0123abc');
    for (const id of ['title_movie_tmdb_550988', 'title_series_tmdb_38527', 'title_series_tmdb_38527_s1', 'title_series_tmdb_38527_s0_e12']) {
      expect(titleIdOf(titlePath(id, 'Some name').split('/').slice(2))).toBe(id);
    }
  });
  it('reads only the number: any name, none, or an old address', () => {
    expect(titleIdOf(['m550988', 'wrong-name'])).toBe('title_movie_tmdb_550988');
    expect(titleIdOf(['m550988'])).toBe('title_movie_tmdb_550988');
    expect(titleIdOf(['title_movie_tmdb_550988'])).toBe('title_movie_tmdb_550988');
    expect(titleIdOf(['s38527', 'episode-3'])).toBe('title_series_tmdb_38527');
    expect(titleIdOf(['m550988', 'season-1'])).toBe('title_movie_tmdb_550988');
    expect(titleIdOf(['x550988'])).toBeNull();
    expect(titleIdOf(['m0'])).toBeNull();
    expect(titleIdOf([])).toBeNull();
  });
});

describe('people and collections', () => {
  it('reads and writes', () => {
    expect(personPath('person_tmdb_1245', 'Scarlett Johansson')).toBe('/person/1245/scarlett-johansson');
    expect(personIdOf('1245')).toBe('person_tmdb_1245');
    expect(personIdOf('person_tmdb_1245')).toBe('person_tmdb_1245');
    expect(collectionPath('collection_645', 'Collection James Bond')).toBe('/collection/645/collection-james-bond');
    expect(collectionIdOf('645')).toBe('collection_645');
  });
});

describe('categories', () => {
  const all = [{ id: 'cat_a', name: 'Films' }, { id: 'cat_b', name: 'Séries' }, { id: 'cat_c', name: 'Kids' }, { id: 'cat_d', name: 'Kids' }] as never[];
  it('goes by name, by ID when two share it', () => {
    expect(categoryPath(all[0], all)).toBe('/category/films');
    expect(categoryPath(all[1], all)).toBe('/category/series');
    expect(categoryPath(all[2], all)).toBe('/category/cat_c');
    expect(categoryIdOf('films', all)).toBe('cat_a');
    expect(categoryIdOf('cat_b', all)).toBe('cat_b');
    expect(categoryIdOf('kids', all)).toBe('kids');
  });
});
