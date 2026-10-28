// The main pages read ahead: once the page the site opened on has what it
// shows (or a few seconds after, at most), the menu's other pages are read
// one after another, in the menu's order (home first), and kept for the
// tab like pages already seen (homecache, pagecache), so opening one shows
// it at once. Once per profile in a tab; never while a video plays, nor
// when the browser asks to save data. The libraries only while the menu
// shows them.

import { overfin } from './client';
import { keepHome, keptHome } from './homecache';
import { loadHome } from './homeload';
import { lastLibraryId, lastSort } from './lastlibrary';
import { listKey, listQuery, listSort } from './lists';
import { cached, keepList, keptList } from './pagecache';
import { router } from './router.svelte';
import { session } from './session.svelte';

type DiscoverList = 'trending' | 'popular' | 'upcoming';
type Kind = 'movie' | 'series';
type Availability = 'all' | 'library' | 'missing';

/** discoverRows are Discover's rows, in their order. */
export const discoverRows = [
  { list: 'trending', kind: 'movie', key: 'discover.trendingMovies' },
  { list: 'trending', kind: 'series', key: 'discover.trendingSeries' },
  { list: 'popular', kind: 'movie', key: 'discover.popularMovies' },
  { list: 'popular', kind: 'series', key: 'discover.popularSeries' },
  { list: 'upcoming', kind: 'movie', key: 'discover.upcomingMovies' },
  { list: 'upcoming', kind: 'series', key: 'discover.upcomingSeries' },
] as const;

/** discoverRow reads one of Discover's rows, kept for the tab. */
export function discoverRow(list: DiscoverList, kind: Kind, availability: Availability) {
  const profile = session.me?.activeProfile?.id;
  return cached(`discover:${profile}:${list}:${kind}:${availability}`,
    () => overfin.discover(list, kind, { availability, limit: 20 }));
}

// A list's first page, kept as the list page keeps it.
async function warmList(profile: string, id: string, category: boolean, libraryKind?: string) {
  const sort = listSort(lastSort(profile));
  if (sort === 'random') return; // a new shuffle each time it opens
  const key = listKey(profile, `/${category ? 'category' : 'library'}/${id}`, new URLSearchParams(), sort, '');
  if (keptList(key)) return;
  const pages = overfin.pages(listQuery(id, category, libraryKind, { sort }));
  const { value: page, done } = await pages.next();
  if (done) keepList(key, { items: [], finished: true });
  else keepList(key, { items: page.items, total: page.totalCount, finished: !page.nextCursor, pages });
}

async function warmHome(profile: string) {
  if (keptHome(profile)) return;
  const asked = Date.now();
  keepHome(profile, await loadHome(), asked);
}

function saveData(): boolean {
  return !!(navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
}

let warmed = '';
let timer: ReturnType<typeof setTimeout> | undefined;

/** landed says the page shown has what it shows: the rest can be read. */
export function landed() {
  clearTimeout(timer);
  timer = setTimeout(warm, 300);
}

/** warmLater reads the rest a few seconds from now, if no page said it
 * landed before (one that doesn't). */
export function warmLater() {
  clearTimeout(timer);
  timer = setTimeout(warm, 3000);
}

async function warm() {
  const profile = session.me?.activeProfile?.id;
  if (!profile || warmed === profile || saveData()) return;
  const where = router.route.parts[0];
  if (where === 'play' || where === 'profiles') return; // once one's chosen, or the video's over
  warmed = profile;
  const steps: (() => Promise<unknown>)[] = [() => warmHome(profile)];
  if (session.discovery) {
    for (const row of discoverRows) steps.push(() => discoverRow(row.list, row.kind, 'missing'));
  }
  for (const c of session.categories) steps.push(() => warmList(profile, c.id, true));
  if (session.librariesShown) {
    const id = lastLibraryId(session.libraries);
    const library = session.libraries.find((l) => l.id === id);
    if (library) steps.push(() => warmList(profile, library.id, false, library.kind));
  }
  for (const step of steps) {
    // Another profile, or a video started: the rest waits.
    if (session.me?.activeProfile?.id !== profile) return;
    if (router.route.parts[0] === 'play') {
      warmed = '';
      return;
    }
    await step().catch(() => {});
  }
}
