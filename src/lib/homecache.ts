// The home page's rows, kept for the open tab: shown at once when the
// profile comes back to it, and read again in the background once they're
// a few minutes old, or after something they show changed (a playback, a
// mark). Each profile its own; nothing is kept beyond the tab.

import { pagesChanged } from './pagecache';

/** fresh is how long kept rows are shown without reading them again. */
const fresh = 5 * 60_000;

let kept: { profile: string; at: number; data: unknown } | null = null;
let changedAt = 0;

/** keptHome returns the rows kept for the profile, and whether they should
 * be read again; null when there are none. */
export function keptHome<T>(profile: string): { data: T; old: boolean } | null {
  if (!kept || kept.profile !== profile) return null;
  return { data: kept.data as T, old: kept.at < changedAt || Date.now() - kept.at > fresh };
}

/** keepHome keeps the rows just read, as of when they were asked for (at):
 * a change while they were on their way leaves them old. */
export function keepHome(profile: string, data: unknown, at = Date.now()) {
  kept = { profile, at, data };
}

/** homeChanged says something the home page shows changed: it's read again
 * the next time it's shown. */
export function homeChanged() {
  // A tick later than anything asked for until now, even within the same
  // millisecond.
  changedAt = Date.now() + 1;
  pagesChanged();
}

// The slideshow, kept the same way: its titles and the one it was on, so
// coming back shows it as it was left.
let slideshow: { profile: string; titles: unknown[]; index: number } | null = null;

/** keptSlides returns the profile's slideshow, null when there's none. */
export function keptSlides<T>(profile: string): { titles: T[]; index: number } | null {
  return slideshow && slideshow.profile === profile ? { titles: slideshow.titles as T[], index: slideshow.index } : null;
}

/** keepSlides keeps the slideshow, and which slide shows. */
export function keepSlides(profile: string, titles: unknown[], index: number) {
  slideshow = { profile, titles, index };
}
