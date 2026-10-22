// Who's here: the account, its active profile, and the libraries that
// profile sees (each profile its own, kids limits included).
import type { Library, Me } from './sdk/overfin.js';
import { overfin } from './client';

export const session = $state<{ me: Me | null; libraries: Library[]; discovery: boolean; requests: boolean; kidsNeedLimits: boolean }>({
  me: null, libraries: [], discovery: false, requests: false, kidsNeedLimits: false,
});

/** offersDiscovery asks the server whether it offers discovery (it does once
 * Seerr is connected). */
export async function offersDiscovery(): Promise<boolean> {
  return overfin.discover('trending', 'movie', { limit: 1 }).then(() => true, () => false);
}

/** offersRequests asks the server whether it takes requests (it does once
 * Seerr is connected). */
export async function offersRequests(): Promise<boolean> {
  return overfin.requests().then(() => true, () => false);
}

/** kidsNeedLimits says, for the owner, whether a kids profile has no
 * limits yet (it shows nothing until they're chosen). */
export async function kidsNeedLimits(): Promise<boolean> {
  if (!session.me?.activeProfile?.owner) return false;
  return overfin.profiles().then((all) => all.some((p) => p.ceilingsNeeded), () => false);
}

/** refresh reloads who's here, after a profile change. */
export async function refresh() {
  session.me = await overfin.me();
  session.libraries = await overfin.libraries().catch(() => []);
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
