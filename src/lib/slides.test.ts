import { describe, expect, it, vi } from 'vitest';

const asked: string[][] = [];
vi.mock('./client', () => ({
  overfin: {
    batch: async (paths: string[]) => {
      asked.push(paths);
      return paths.map((p, i) => {
        const id = decodeURIComponent(p.replace('/titles/', ''));
        if (id === 'fails') return new Error('503');
        if (id.startsWith('nobackdrop')) return { id, images: {} };
        return { id, images: { backdrops: ['/b.jpg'], logo: i % 2 === 0 ? undefined : '/l.png' } };
      });
    },
  },
}));

const { pickSlides } = await import('./slides');

const titles = (ids: string[]) => ids.map((id) => ({ id }) as never);

describe("the home page's slides", () => {
  it('are titles with a backdrop, those with a logo first, failures left out', async () => {
    asked.length = 0;
    const got = await pickSlides({ random: titles(['a', 'b', 'nobackdrop1', 'fails', 'c', 'a']) });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toEqual(['/titles/a', '/titles/b', '/titles/nobackdrop1', '/titles/fails', '/titles/c']);
    const ids = got.map((t) => t.id);
    expect(ids).toHaveLength(3);
    expect(ids.slice(0, 1)).toEqual(['b']); // b has a logo (odd place)
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('ask 20 at most in one request, and keep 10', async () => {
    asked.length = 0;
    const many = Array.from({ length: 30 }, (_, i) => 't' + i);
    const got = await pickSlides({ random: titles(many) });
    expect(asked[0]).toHaveLength(20);
    expect(got).toHaveLength(10);
  });

  it('are none from no titles, without asking', async () => {
    asked.length = 0;
    expect(await pickSlides({ random: [] })).toEqual([]);
    expect(asked).toHaveLength(0);
  });

  it('keep an id that needs escaping intact', async () => {
    asked.length = 0;
    await pickSlides({ random: titles(['title_x/../y']) });
    expect(asked[0][0]).toBe('/titles/title_x%2F..%2Fy');
  });
});
