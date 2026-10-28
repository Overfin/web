// Asking for a title no library has: what will be asked, confirmed first,
// then the request, or why it failed, said to the person.
import type { TitleSummary } from './sdk/overfin.js';
import { explain, overfin } from './client';
import { confirm, notice } from './dialog.svelte';
import { homeChanged } from './homecache';
import { t } from './i18n.svelte';

/** question says what asking for x requests: a film, a whole series, or a
 * season (an episode's season), with its episodes when known. */
export function question(x: TitleSummary): string {
  if (x.kind === 'series') return t('request.confirmSeries', { name: x.name });
  if (x.kind === 'season' || x.kind === 'episode') {
    const name = x.series?.name ?? x.name;
    const number = x.seasonNumber ?? '?';
    const episodes = x.kind === 'season' ? x.episodeCount?.aired : undefined;
    return episodes
      ? t('request.confirmSeasonEpisodes', { number, name, episodes })
      : t('request.confirmSeason', { number, name });
  }
  return t('request.confirm', { name: x.name });
}

/** ask requests a title (a season or an episode: its season; a series:
 * every season) once the person confirms, and returns the request
 * covering it, or null when they didn't or it failed (they're told why). */
export async function ask(x: TitleSummary): Promise<TitleSummary['request'] | null> {
  if (!(await confirm(question(x)))) return null;
  try {
    const made = await overfin.requestTitle(x.id);
    homeChanged(); // pages kept in the tab say it's asked for
    return { id: made.id, status: made.status };
  } catch (err) {
    await notice(explain(err));
    return null;
  }
}
