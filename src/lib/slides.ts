// The home page's slideshow: which titles it shows, picked by the
// slideshow, or ahead of it by the main pages' warming (warm.ts), which
// also loads their pictures ahead.

import type { Title, TitleSummary } from './sdk/overfin.js';
import { overfin } from './client';
import type { HomeData } from './homeload';

/** SlideSources are the lists the slides are picked from. missing: trending
 * titles no library has may be shown too, to be requested from their page. */
export interface SlideSources {
  trending: { movie: TitleSummary[]; series: TitleSummary[] };
  latest: TitleSummary[];
  random: TitleSummary[];
  acclaimed: TitleSummary[];
  recommended: TitleSummary[];
  missing: boolean;
}

/** slideSources are the home page's rows as the slideshow takes them: the
 * newest of every section in turn. */
export function slideSources(home: HomeData, missing: boolean): SlideSources {
  return {
    trending: home.trending, random: home.random, acclaimed: home.acclaimed, recommended: home.recommended, missing,
    latest: home.latest.flatMap((l) => l.items.map((item, i) => ({ item, i }))).sort((a, b) => a.i - b.i).map((x) => x.item),
  };
}

// How many slides, and how many candidates for them: some have no backdrop
// and are left out.
const count = 10;
const candidates = 16;

// shuffled is a copy of list in random order.
function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** ids picks the titles: up to five among those that fit the profile best,
 * then trending, newly added and best rated ones, then random ones, in a
 * random order. */
function ids(s: SlideSources): string[] {
  const inLibrary = (list: TitleSummary[]) => (s.missing ? list : list.filter((title) => title.availability !== 'missing'));
  const picks = new Set<string>();
  const take = (list: TitleSummary[], n: number) => {
    for (const title of list) {
      if (picks.size >= candidates || n <= 0) return;
      if (!picks.has(title.id)) {
        picks.add(title.id);
        n--;
      }
    }
  };
  take(shuffled(s.recommended.slice(0, 12)), 5);
  take(shuffled(inLibrary([...s.trending.movie.slice(0, 12), ...s.trending.series.slice(0, 12)])), 3);
  take(shuffled(s.latest.slice(0, 12)), 2);
  take(shuffled(s.acclaimed), 2);
  take(s.random, candidates);
  return shuffled([...picks]);
}

/** pickSlides picks the slides, with each title's page (for its overview
 * and genres) in one request; those without a backdrop, or failing, are
 * left out. */
export async function pickSlides(s: SlideSources): Promise<Title[]> {
  const chosen = ids(s);
  if (!chosen.length) return [];
  const items = await overfin.batch(chosen.map((id) => `/titles/${encodeURIComponent(id)}`));
  return items.filter((it): it is Title => !(it instanceof Error) && !!(it as Title)?.images?.backdrops?.[0]).slice(0, count);
}

/** preloadSlides loads the slides' backdrops and logos ahead, one at a
 * time, as long as go says to; on a screen taller than wide, their posters
 * instead of their backdrops (PageBackdrop shows those there). */
export async function preloadSlides(slides: Title[], go: () => boolean) {
  const tall = typeof matchMedia === 'function' && matchMedia('(max-aspect-ratio: 1/1)').matches;
  for (const slide of slides) {
    const picture = tall ? (slide.images?.primary ?? slide.images?.backdrops?.[0]) : slide.images?.backdrops?.[0];
    for (const [image, size] of [[picture, 'large'], [slide.images?.logo, 'medium']] as const) {
      if (!image) continue;
      if (!go()) return;
      await new Promise<void>((done) => {
        const img = new Image();
        img.onload = img.onerror = () => done();
        img.src = overfin.imageUrl(image, size);
      });
    }
  }
}
