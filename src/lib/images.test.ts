import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ overfin: { imageUrl: (ref: { url: string }, size = 'medium') => `${ref.url}?size=${size}` } }));
const { sized, srcset } = await import('./images');

const poster = { url: '/api/v1/images/tmdbart_poster_abcdefgh12_jpg' };
const still = { url: '/api/v1/images/tmdbart_still_abcdefgh12_jpg' };
const upload = { url: '/api/v1/images/titleup_' + 'a'.repeat(32) };
const jellyfin = { url: '/api/v1/images/item_0123_primary_0_abc' };

describe('images', () => {
  it('lists every width Overfin makes of a TMDB image, its kind from its address', () => {
    expect(srcset(poster, 'backdrop')).toBe([200, 400, 800, 1200, 2000].map((w) => `${poster.url}?width=${w} ${w}w`).join(', '));
    expect(srcset(still, 'poster')).toContain('?width=1280 1280w');
    expect(srcset(still, 'poster')).not.toContain('1920');
  });
  it('takes the kind the caller says for an upload, and sizes none of Jellyfin\'s', () => {
    expect(srcset(upload, 'logo')).toContain('?width=2000 2000w');
    expect(srcset(jellyfin, 'poster')).toBeUndefined();
    expect(srcset(undefined, 'poster')).toBeUndefined();
  });
  it('sizes a background for the screen: the width just above, the largest beyond', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    expect(sized({ url: '/api/v1/images/tmdbart_backdrop_abcdefgh12_jpg' }, 'backdrop', 1000)).toMatch(/\?width=3840$/);
    vi.stubGlobal('devicePixelRatio', 1);
    expect(sized({ url: '/api/v1/images/tmdbart_backdrop_abcdefgh12_jpg' }, 'backdrop', 1000)).toMatch(/\?width=1280$/);
    expect(sized({ url: '/api/v1/images/tmdbart_backdrop_abcdefgh12_jpg' }, 'backdrop', 9999)).toMatch(/\?width=3840$/);
    expect(sized(jellyfin, 'backdrop', 1000)).toBe(`${jellyfin.url}?size=large`);
    expect(sized(undefined, 'backdrop', 1000)).toBe('');
  });
});
