// The profile's wishlist, as the pages show it: which titles are on it
// (loaded once, kept up to date here), putting one on or taking it off.
import type { TitleSummary } from './sdk/overfin.js';
import { explain, overfin } from './client';
import { notice } from './dialog.svelte';
import { t } from './i18n.svelte';
import { session } from './session.svelte';

export const wishes = $state<{ ids: Record<string, true>; loaded: boolean; on: boolean }>({ ids: {}, loaded: false, on: true });

let loading: Promise<void> | null = null;
// The profile they were read for: another one reads its own.
let loadedFor = '';

/** loadWishes reads which titles are on the active profile's wishlist,
 * once per profile (again with fresh). */
export function loadWishes(fresh = false): Promise<void> {
  const profile = session.me?.activeProfile?.id ?? '';
  if (!session.wishes || !profile) return Promise.resolve();
  if (loading && loadedFor === profile && !fresh) return loading;
  loadedFor = profile;
  wishes.ids = {};
  loading = overfin.wishlist().then((w) => {
    wishes.ids = Object.fromEntries(w.items.map((i) => [i.title.id, true as const]));
    wishes.on = w.on;
    wishes.loaded = true;
  }, () => {});
  return loading;
}

/** wishable says whether x can go on the wishlist: offered, and a film
 * not here, a season not here whole, or a series with such seasons
 * (seasons): never an episode. */
export function wishable(x: TitleSummary, seasons?: TitleSummary[]): boolean {
  if (!session.wishes || x.availability === 'available') return false;
  switch (x.kind) {
    case 'movie':
      return !x.playable;
    case 'season':
      return true;
    case 'series':
      return wishableSeasons(seasons ?? []).length > 0;
  }
  return false;
}

/** wishableSeasons are a series' seasons a wish for it adds: out now
 * (specials aside) and not here whole. */
export function wishableSeasons(seasons: TitleSummary[]): TitleSummary[] {
  const today = new Date().toISOString().slice(0, 10);
  return seasons.filter((s) => (s.seasonNumber ?? 0) > 0 && !!s.airDate && s.airDate <= today && s.availability !== 'available');
}

/** seriesWished says whether all of a series' seasons a wish adds are on
 * the wishlist. */
export function seriesWished(seasons: TitleSummary[]): boolean {
  const all = wishableSeasons(seasons);
  return all.length > 0 && all.every((s) => wishes.ids[s.id]);
}

/** toggleSeries puts a series' seasons on the wishlist, or takes them all
 * off. */
export async function toggleSeries(series: TitleSummary, seasons: TitleSummary[]): Promise<void> {
  try {
    if (seriesWished(seasons)) await overfin.removeFromWishlist(series.id);
    else await overfin.addToWishlist(series.id);
  } catch (err) {
    await notice(explain(err));
  }
  await loadWishes(true);
}

/** toggleWish puts x on the wishlist, or takes it off; the person is told
 * when that fails. */
export async function toggleWish(x: TitleSummary): Promise<void> {
  const on = !!wishes.ids[x.id];
  try {
    if (on) {
      await overfin.removeFromWishlist(x.id);
      delete wishes.ids[x.id];
    } else {
      await overfin.addToWishlist(x.id);
      wishes.ids[x.id] = true;
    }
  } catch (err) {
    await notice(explain(err));
  }
}

/** tellArrived says, once, which wished titles arrived since the profile
 * was last told (they're on its watchlist now), unless it's on the
 * wishlist page, which lists them itself. */
export async function tellArrived(onWishlistPage: boolean): Promise<void> {
  if (!session.wishes || onWishlistPage) return;
  const w = await overfin.wishlist().catch(() => null);
  if (!w?.arrived.length) return;
  await overfin.wishesSeen().catch(() => {});
  await notice(w.arrived.length === 1 ? t('wish.arrivedNotice', { name: w.arrived[0].name })
    : t('wish.arrivedManyNotice', { count: w.arrived.length }));
}
