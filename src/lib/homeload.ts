// The home page's rows, read in one request: by the home page, and ahead
// of it by the main pages' warming (warm.ts).

import type { TitleSummary } from './sdk/overfin.js';
import { overfin } from './client';
import { session } from './session.svelte';

// The slideshow's random picks: new each time the site opens, the same
// while browsing it.
const seed = String(Math.floor(Math.random() * 1e9));

type Call = [string, Record<string, string | number | string[]>];

/** homeAvailability is which titles the trending rows and the slideshow
 * take: all of them when the operator wants the ones no library has there
 * too, else the library's. */
export function homeAvailability(): 'all' | 'library' {
  return session.me?.home?.missingTitles ? 'all' : 'library';
}

// What's new: in each home category, then in each library (while the
// menu shows them).
function sections() {
  return [
    ...session.categories.filter((c) => c.home).map((c) => ({ id: c.id, name: c.name,
      call: ['/titles', { kind: ['movie', 'series'], category: c.id, sort: 'addedAt', order: 'desc', limit: 16 }] as Call })),
    ...(session.librariesShown ? session.libraries : []).map((l) => ({ id: l.id, name: l.name,
      call: ['/titles/latest', { library: l.id, limit: 16 }] as Call })),
  ];
}

/** loadHome reads every row in one request (the server answers each as it
 * would alone). */
export async function loadHome() {
  const availability = homeAvailability();
  const latest = sections();
  const trending = session.discovery ? (['movie', 'series'] as const) : [];
  const answers = await overfin.batch([
    ['/titles/continue', { limit: 20 }],
    '/me/watchlist',
    ...trending.map((kind): Call => ['/discover', { list: 'trending', mediaKind: kind, availability, limit: 20 }]),
    ...latest.map((x) => x.call),
    // What fits the profile: among everything, and among the newest.
    ['/titles/recommended', { scope: 'all', limit: 20 }],
    ['/titles/recommended', { scope: 'recent', limit: 20 }],
    // For the slideshow: the library at random, and its best rated.
    ['/titles', { kind: ['movie', 'series'], sort: 'random', seed, limit: 30 }],
    ['/titles', { kind: ['movie', 'series'], sort: 'communityRating', order: 'desc', limit: 40 }],
  ]);
  // A row that failed is empty; Continue Watching failing fails the page.
  const items = (a: unknown): TitleSummary[] => (a instanceof Error ? [] : (a as { items: TitleSummary[] }).items);
  if (answers[0] instanceof Error) throw answers[0];
  const rest = answers.slice(2 + trending.length, 2 + trending.length + latest.length);
  const [recommended, recent, random, acclaimed] = answers.slice(-4).map(items);
  return {
    random, acclaimed, recommended, recent,
    resume: items(answers[0]),
    watchlist: items(answers[1]), // the server may not offer it
    trending: trending.length ? { movie: items(answers[2]), series: items(answers[3]) } : { movie: [], series: [] },
    latest: latest.map((section, i) => ({ section, items: items(rest[i]) })),
  };
}

export type HomeData = Awaited<ReturnType<typeof loadHome>>;
