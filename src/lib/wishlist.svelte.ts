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
 * once per profile. */
export function loadWishes(): Promise<void> {
  const profile = session.me?.activeProfile?.id ?? '';
  if (!session.wishes || !profile) return Promise.resolve();
  if (loading && loadedFor === profile) return loading;
  loadedFor = profile;
  wishes.ids = {};
  loading = overfin.wishlist().then((w) => {
    wishes.ids = Object.fromEntries(w.items.map((i) => [i.title.id, true as const]));
    wishes.on = w.on;
    wishes.loaded = true;
  }, () => {});
  return loading;
}

/** wishable says whether x can go on the wishlist: offered, not here
 * whole, a film, a whole series or a season (never an episode). */
export function wishable(x: TitleSummary): boolean {
  return session.wishes && !x.playable && x.availability !== 'available' &&
    (x.kind === 'movie' || x.kind === 'series' || x.kind === 'season');
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
