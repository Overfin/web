// Title pages through the page cache: the title, a season's page, the
// similar titles, each kept per profile.
import type { Title, TitleSummary } from './sdk/overfin.js';
import { overfin } from './client';
import { cached, prefetch } from './pagecache';
import { session } from './session.svelte';

const who = () => session.me?.activeProfile?.id ?? '';

/** titleOf is a title's page (a season's too). */
export function titleOf(id: string): Promise<Title> {
  return cached(`${who()}:title:${id}`, () => overfin.title(id));
}

/** similarOf is the titles like this one. */
export function similarOf(id: string): Promise<TitleSummary[]> {
  return cached(`${who()}:similar:${id}`, () => overfin.similar(id));
}

// The pictures already asked for, so each is only asked once.
const pictured = new Set<string>();

/** prefetchTitle reads a title's page ahead, for its card's link, and the
 * pictures its top shows (the browser keeps them for the page). */
export function prefetchTitle(id: string) {
  prefetch(`${who()}:similar:${id}`, () => overfin.similar(id));
  if (pictured.has(id)) {
    prefetch(`${who()}:title:${id}`, () => overfin.title(id));
    return;
  }
  pictured.add(id);
  titleOf(id).then((title) => {
    const backdrop = title.images?.backdrops?.[0] ?? (title.kind === 'episode' ? title.images?.primary : undefined);
    const urls = [
      backdrop && overfin.imageUrl(backdrop, 'large'),
      title.kind !== 'episode' && title.images?.primary && overfin.imageUrl(title.images.primary, 'medium'),
      title.images?.logo && overfin.imageUrl(title.images.logo, 'medium'),
    ];
    for (const url of urls) if (url) new Image().src = url;
  }, () => pictured.delete(id));
}
