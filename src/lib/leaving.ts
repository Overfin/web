// When a title leaves the server, as its card and page say it: in days,
// in hours under a day, "less than an hour" at the end. In French the
// word agrees with the title: a film « Retiré », a series or a season
// « Retirée ».

import { t } from './i18n.svelte';

const hour = 3_600_000;
const day = 24 * hour;

/** leavingText says when a title leaving at iso (leavesAt) goes, or ""
 * once it's past. */
export function leavingText(iso: string | undefined, kind: string, now = Date.now()): string {
  if (!iso) return '';
  const left = new Date(iso).getTime() - now;
  if (!(left > 0)) return '';
  const g = kind === 'movie' ? 'm' : 'f';
  if (left >= day) {
    const n = Math.max(1, Math.round(left / day));
    return n === 1 ? t(`leaving.${g}.day`) : t(`leaving.${g}.days`, { n });
  }
  const n = Math.floor(left / hour);
  if (n >= 2) return t(`leaving.${g}.hours`, { n });
  return n === 1 ? t(`leaving.${g}.hour`) : t(`leaving.${g}.soon`);
}
