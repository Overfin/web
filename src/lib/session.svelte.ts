// Who's here: the account, its active profile, and the libraries that
// profile sees (each profile its own, kids limits included).
import type { Category, Library, Me } from './sdk/overfin.js';
import { overfin } from './client';

export const session = $state<{
  me: Me | null; libraries: Library[]; categories: Category[]; librariesShown: boolean;
  discovery: boolean; requests: boolean; kidsNeedLimits: boolean;
}>({
  me: null, libraries: [], categories: [], librariesShown: true, discovery: false, requests: false, kidsNeedLimits: false,
});

/** loadCategories reads the operator's categories, and whether the menu
 * shows the libraries (a server before 0.6 has none, and shows them). */
export async function loadCategories() {
  const c = await overfin.categories().catch(() => ({ items: [], libraries: true }));
  session.categories = c.items;
  session.librariesShown = c.libraries || !c.items.length;
}

/** offersDiscovery says whether the server offers discovery (with TMDB or
 * Seerr): /me says so; a server before 0.5 is asked. */
export async function offersDiscovery(): Promise<boolean> {
  if (session.me?.offers) return session.me.offers.discovery;
  return overfin.discover('trending', 'movie', { limit: 1 }).then(() => true, () => false);
}

/** offersRequests says whether the server takes requests (with Seerr): /me
 * says so; a server before 0.5 is asked. */
export async function offersRequests(): Promise<boolean> {
  if (session.me?.offers) return session.me.offers.requests;
  return overfin.requests().then(() => true, () => false);
}

/** kidsNeedLimits says, for the owner, whether a kids profile has no
 * limits yet (it shows nothing until they're chosen). */
export async function kidsNeedLimits(): Promise<boolean> {
  if (!session.me?.activeProfile?.owner) return false;
  return overfin.profiles().then((all) => all.some((p) => p.ageNeeded), () => false);
}

/** mayAddProfile says whether the active profile may add one to the
 * account's count of profiles: the owner, under the template's limit (0
 * is none). */
export function mayAddProfile(count: number): boolean {
  const me = session.me;
  if (!me?.activeProfile?.owner) return false;
  return !(me.limits?.maxProfiles > 0 && count >= me.limits.maxProfiles);
}

/** refresh reloads who's here, after a profile change. */
export async function refresh() {
  session.me = await overfin.me();
  session.libraries = await overfin.libraries().catch(() => []);
  await loadCategories();
  session.discovery = await offersDiscovery();
  session.requests = await offersRequests();
  session.kidsNeedLimits = await kidsNeedLimits();
}

const pickedKey = 'overfin-web-picked';

/** picked reports whether a profile was chosen in this tab. */
export function picked(): boolean {
  return sessionStorage.getItem(pickedKey) === '1';
}

export function setPicked(on: boolean) {
  if (on) sessionStorage.setItem(pickedKey, '1');
  else sessionStorage.removeItem(pickedKey);
}
