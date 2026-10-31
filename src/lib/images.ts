// Images at the size each screen needs. Overfin makes its titles' artwork
// (TMDB's, and what admins upload) at a few widths per kind of image, from
// one original; the site lists them (srcset) and the browser takes the one
// that fits where the image is drawn, on its screen: a phone gets small
// ones, a 4K TV large ones. Other images (Jellyfin's) come at one size.
import { overfin } from './client';
import type { ImageRef } from './sdk/overfin.js';

/** The widths Overfin makes of each kind, as the server's ladders. */
const widths = {
  poster: [200, 400, 800, 1200, 2000],
  backdrop: [320, 640, 1280, 1920, 3840],
  logo: [250, 500, 1000, 2000],
  still: [320, 640, 1280],
  profile: [200, 400, 800],
} as const;

export type Kind = keyof typeof widths;

/** The kind of image a TMDB one is, from its address; for an upload, the
 * one the caller says. Null for images Overfin doesn't size (Jellyfin's). */
function kindOf(ref: ImageRef, kind: Kind): Kind | null {
  const m = ref.url.match(/\/images\/(tmdbart_([a-z]+)_|titleup_)/);
  if (!m) return null;
  const tmdb = m[2] as Kind | undefined;
  return tmdb && tmdb in widths ? tmdb : kind;
}

/** srcset lists an image at every width Overfin makes of it; undefined for
 * one it doesn't size (src alone then). */
export function srcset(ref: ImageRef | undefined, kind: Kind): string | undefined {
  const k = ref && kindOf(ref, kind);
  if (!ref || !k) return undefined;
  return widths[k].map((w) => `${ref.url}?width=${w} ${w}w`).join(', ');
}

/** sized is an image's address for something drawn cssWidth CSS pixels
 * wide on this screen (a page's background, say, which srcset can't
 * reach): the width Overfin makes just above, the largest beyond. An image
 * it doesn't size gets its size by name, as before. */
export function sized(ref: ImageRef | undefined, kind: Kind, cssWidth: number, fallback: 'small' | 'medium' | 'large' = 'large'): string {
  if (!ref) return '';
  const k = kindOf(ref, kind);
  if (!k) return overfin.imageUrl(ref, fallback);
  const px = Math.ceil(cssWidth * (globalThis.devicePixelRatio || 1));
  const list = widths[k];
  return `${ref.url}?width=${list.find((w) => w >= px) ?? list[list.length - 1]}`;
}

/** screenWidth is the width a page's background is drawn at: the window's. */
export function screenWidth(): number {
  return globalThis.innerWidth || 1280;
}

/** sizes are how wide each place draws its image, for srcset: the
 * stylesheet's widths (app.css), so the browser takes the size it needs. */
export const sizes = {
  card: '(max-width: 37.5rem) 28vw, 10.5rem',
  wideCard: '(max-width: 37.5rem) 45vw, 17rem',
  heroPoster: '(max-width: 37.5rem) 8rem, 11rem',
  logo: '(max-width: 37.5rem) 80vw, 26rem',
  episode: '(max-width: 37.5rem) 90vw, 22rem',
  smallStill: '12rem',
  face: '8rem',
  page: '100vw',
} as const;

/** preload fetches an image ahead, at the size the browser will take for
 * where it's drawn (its srcset and sizes), so showing it waits for
 * nothing. Resolves once it's in, or failed. */
export function preload(ref: ImageRef | undefined, kind: Kind, size: string): Promise<void> {
  if (!ref) return Promise.resolve();
  return new Promise((done) => {
    const img = new Image();
    img.onload = img.onerror = () => done();
    const set = srcset(ref, kind);
    if (set) {
      img.sizes = size;
      img.srcset = set;
    }
    img.src = overfin.imageUrl(ref, 'medium');
  });
}
