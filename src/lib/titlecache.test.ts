import { beforeEach, describe, expect, it, vi } from 'vitest';

const keys: string[] = [];
const asked: string[] = [];
let fail = false;
vi.mock('./client', () => ({
  overfin: {
    title: async (id: string) => {
      asked.push(`title ${id}`);
      if (fail) throw new Error('down');
      return { id, kind: 'movie', images: { backdrops: [{ url: 'b' }], primary: { url: 'p' }, logo: { url: 'l' } } };
    },
    similar: async (id: string) => {
      asked.push(`similar ${id}`);
      return [];
    },
  },
}));
vi.mock('./pagecache', () => ({
  cached: (key: string, fn: () => Promise<unknown>) => {
    keys.push(key);
    return fn();
  },
  prefetch: (key: string, fn: () => Promise<unknown>) => {
    keys.push(`ahead ${key}`);
    return fn();
  },
}));
vi.mock('./session.svelte', () => ({ session: { me: { activeProfile: { id: 'p1' } } } }));
vi.mock('./tv', () => ({ onTV: false }));
const preloaded: string[] = [];
vi.mock('./images', () => ({
  preload: (img: { url: string } | undefined, kind: string) => img && preloaded.push(`${kind} ${img.url}`),
  sized: (img: { url: string }, kind: string) => `${kind} ${img.url}`,
  screenWidth: () => 1920,
  sizes: { heroPoster: '', heroStill: '', logo: '' },
}));

vi.stubGlobal('Image', class {
  set src(url: string) {
    preloaded.push(`image ${url}`);
  }
});

const { titleOf, similarOf, prefetchTitle } = await import('./titlecache');

describe("title pages through the page cache", () => {
  beforeEach(() => {
    keys.length = asked.length = preloaded.length = 0;
    fail = false;
  });

  it("keeps an episode by TMDB's ID of it, whichever ID asks; others as they are; per profile", async () => {
    await titleOf('title_series_tmdb_1399_e63056');
    await titleOf('title_episode_tmdb_63056');
    await titleOf('title_series_tmdb_1399_s1');
    await titleOf('title_movie_tmdb_949');
    await similarOf('title_movie_tmdb_949');
    expect(keys).toEqual(['p1:title:title_episode_tmdb_63056', 'p1:title:title_episode_tmdb_63056',
      'p1:title:title_series_tmdb_1399_s1', 'p1:title:title_movie_tmdb_949', 'p1:similar:title_movie_tmdb_949']);
    // Asked by the ID it was asked with.
    expect(asked[0]).toBe('title title_series_tmdb_1399_e63056');
  });

  it('reads a card\'s page ahead with its pictures once; a failed read is tried again', async () => {
    prefetchTitle('title_movie_tmdb_1');
    await vi.waitFor(() => expect(preloaded).toEqual(['image backdrop b', 'poster p', 'logo l']));
    preloaded.length = 0;
    prefetchTitle('title_movie_tmdb_1');
    await Promise.resolve();
    expect(preloaded).toEqual([]); // the pictures asked once
    expect(keys.at(-1)).toBe('ahead p1:title:title_movie_tmdb_1');

    fail = true;
    prefetchTitle('title_movie_tmdb_2');
    await vi.waitFor(() => expect(asked).toContain('title title_movie_tmdb_2'));
    await new Promise((r) => setTimeout(r, 0));
    fail = false;
    keys.length = 0;
    prefetchTitle('title_movie_tmdb_2');
    await vi.waitFor(() => expect(preloaded).toEqual(['image backdrop b', 'poster p', 'logo l']));
    expect(keys).toContain('p1:title:title_movie_tmdb_2'); // read again, not only ahead
  });
});
