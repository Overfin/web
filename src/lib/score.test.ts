import { describe, expect, it } from 'vitest';
import { score } from './score';

describe("a title's score", () => {
  it("is TMDB's, from 30 votes up", () => {
    expect(score({ ratings: [{ source: 'tmdb', value: 7.25, votes: 30 }] } as never)).toMatchObject({ votes: 30 });
    expect(score({ ratings: [{ source: 'tmdb', value: 7.25, votes: 29 }] } as never)).toBeNull();
  });

  it('never another source, nor none', () => {
    expect(score({ ratings: [{ source: 'imdb', value: 8, votes: 5000 }] } as never)).toBeNull();
    expect(score({ ratings: [] } as never)).toBeNull();
    expect(score({} as never)).toBeNull();
  });

  it('is written with one decimal', () => {
    const s = score({ ratings: [{ source: 'tmdb', value: 7, votes: 100 }] } as never);
    expect(s?.value).toMatch(/^7[.,]0$/);
  });
});
