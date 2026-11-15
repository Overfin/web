// The home page's slideshow: which titles it shows, picked by the
// slideshow, or ahead of it by the main pages' warming (warm.ts), which
// also loads their pictures ahead.

import type { Title, TitleSummary } from './sdk/overfin.js';

import { preload, screenWidth, sized, sizes } from './images';
import { overfin } from './client';
import type { HomeData } from './homeload';

/** SlideSources are what the slides are picked from: the library at
 * random, new each time the site opens. */
export interface SlideSources {
  random: TitleSummary[];
}

/** slideSources are the home page's lists as the slideshow takes them. */
export function slideSources(home: HomeData): SlideSources {
  return { random: home.random };
}

// How many slides, and how many candidates for them: some have no backdrop
// and are left out, and those with a logo go first.
const count = 10;
const candidates = 20; // the most one batch request takes

/** ids picks the titles: the library at random (already shuffled by the
 * server), each once. */
function ids(s: SlideSources): string[] {
  return [...new Set(s.random.map((title) => title.id))].slice(0, candidates);
}

/** pickSlides picks the slides, with each title's page (for its overview
 * and genres) in one request; those without a backdrop, or failing, are
 * left out, and those without a logo come last. */
export async function pickSlides(s: SlideSources): Promise<Title[]> {
  const chosen = ids(s);
  if (!chosen.length) return [];
  const items = await overfin.batch(chosen.map((id) => `/titles/${encodeURIComponent(id)}`));
  const shown = items.filter((it): it is Title => !(it instanceof Error) && !!(it as Title)?.images?.backdrops?.[0]);
  // A slide looks right with its logo: those without go last, if needed.
  return [...shown.filter((it) => it.images?.logo), ...shown.filter((it) => !it.images?.logo)].slice(0, count);
}

/** preloadSlides loads the slides' backdrops and logos ahead, one at a
 * time, as long as go says to; on a screen taller than wide, their
 * text-free posters instead, when they have one (PageBackdrop shows those
 * there). */
export async function preloadSlides(slides: Title[], go: () => boolean) {
  const tall = typeof matchMedia === 'function' && matchMedia('(max-aspect-ratio: 1/1)').matches;
  for (const slide of slides) {
    const picture = tall ? (slide.images?.textless ?? slide.images?.backdrops?.[0]) : slide.images?.backdrops?.[0];
    // As the slideshow shows them: the background for this screen's
    // width, the logo at the size the browser takes for it.
    if (picture) {
      if (!go()) return;
      const url = sized(picture, tall && slide.images?.textless ? 'poster' : 'backdrop', screenWidth());
      await new Promise<void>((done) => {
        const img = new Image();
        img.onload = img.onerror = () => done();
        img.src = url;
      });
    }
    if (slide.images?.logo) {
      if (!go()) return;
      await preload(slide.images.logo, 'logo', sizes.logo);
    }
  }
}
