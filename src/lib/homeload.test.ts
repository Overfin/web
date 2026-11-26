import { beforeEach, describe, expect, it, vi } from 'vitest';

let answer: (path: string, q: Record<string, unknown>) => unknown;
const asked: [string, Record<string, unknown>][] = [];
vi.mock('./client', () => ({
  overfin: {
    batch: async (calls: [string, Record<string, unknown>][]) => {
      asked.push(...calls);
      return calls.map(([p, q]) => answer(p, q));
    },
  },
}));
const session = {
  me: { home: { missingTitles: false } } as { home?: { missingTitles?: boolean } } | null,
  categories: [] as { id: string; name: string; home: boolean }[],
  libraries: [] as { id: string; name: string }[],
  librariesShown: false,
  discovery: false,
};
vi.mock('./session.svelte', () => ({ session }));
vi.mock('./paths', () => ({ categoryPath: (c: { id: string }) => `/c/${c.id}` }));

const { loadHome } = await import('./homeload');

// Each row answers its own items, named after what was asked.
const named = (p: string, q: Record<string, unknown>) =>
  ({ items: [{ id: `${p}|${q.category ?? q.library ?? q.mediaKind ?? q.scope ?? ''}` }], totalCount: q.category ? 42 : undefined });

describe("the home page's rows, in one request", () => {
  beforeEach(() => {
    asked.length = 0;
    answer = named;
    Object.assign(session, { categories: [], libraries: [], librariesShown: false, discovery: false, me: { home: {} } });
  });

  it('put each answer in its row, with every optional row', async () => {
    session.discovery = true;
    session.me = { home: { missingTitles: true } };
    session.categories = [{ id: 'k1', name: 'Kids', home: true }, { id: 'k2', name: 'Hidden', home: false }];
    session.libraries = [{ id: 'lib_a', name: 'Films' }];
    session.librariesShown = true;
    const home = await loadHome();
    expect(home.resume[0].id).toBe('/titles/continue|');
    expect(home.trending.movie[0].id).toBe('/discover|movie');
    expect(home.trending.series[0].id).toBe('/discover|series');
    expect(home.latest.map((l) => [l.section.id, l.items[0].id, l.total])).toEqual([
      ['k1', '/titles|k1', 42], ['lib_a', '/titles/latest|lib_a', undefined]]);
    expect(home.latest[0].section.path).toBe('/c/k1?sort=addedAt');
    expect(home.leaving[0].id).toBe('/titles/leaving|');
    expect(home.recommended[0].id).toBe('/titles/recommended|all');
    expect(home.recent[0].id).toBe('/titles/recommended|recent');
    expect(home.random[0].id).toBe('/titles|');
    expect(asked.find(([p]) => p === '/discover')?.[1].availability).toBe('all');
  });

  it('without discovery nor libraries shown, still line up', async () => {
    session.libraries = [{ id: 'lib_a', name: 'Films' }];
    const home = await loadHome();
    expect(home.trending).toEqual({ movie: [], series: [] });
    expect(home.latest).toEqual([]);
    expect(home.leaving[0].id).toBe('/titles/leaving|');
    expect(home.random[0].id).toBe('/titles|');
    expect(asked.some(([p]) => p === '/discover')).toBe(false);
  });

  it('leave a failed row empty, but fail with Continue watching', async () => {
    session.discovery = true;
    answer = (p, q) => (p === '/discover' || p === '/titles/leaving' ? new Error('503') : named(p, q));
    const home = await loadHome();
    expect(home.trending).toEqual({ movie: [], series: [] });
    expect(home.leaving).toEqual([]);
    expect(home.recommended).toHaveLength(1);
    answer = (p, q) => (p === '/titles/continue' ? new Error('down') : named(p, q));
    await expect(loadHome()).rejects.toThrow('down');
  });
});
