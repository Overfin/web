<!-- Home: a slideshow of featured titles, what to continue (next episodes
     included), the watchlist, what's trending
     among the library's titles, and what's new in each library (films and
     series only). -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { session } from '../lib/session.svelte';
  import PageError from '../components/PageError.svelte';
  import DiscoverRow from '../components/DiscoverRow.svelte';
  import Row from '../components/Row.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import Slides from '../components/Slides.svelte';

  // Every row in one request (the server answers each as it would alone).
  async function load() {
    const trending = session.discovery ? (['movie', 'series'] as const) : [];
    const answers = await overfin.batch([
      ['/titles/continue', { limit: 20 }],
      '/me/watchlist',
      ...trending.map((kind): [string, Record<string, string | number>] =>
        ['/discover', { list: 'trending', mediaKind: kind, availability: 'library', limit: 20 }]),
      ...session.libraries.map((library): [string, Record<string, string | number>] =>
        ['/titles/latest', { library: library.id, limit: 16 }]),
    ]);
    // A row that failed is empty; Continue Watching failing fails the page.
    const items = (a: unknown): TitleSummary[] => (a instanceof Error ? [] : (a as { items: TitleSummary[] }).items);
    if (answers[0] instanceof Error) throw answers[0];
    const rest = answers.slice(2 + trending.length);
    return {
      resume: items(answers[0]),
      watchlist: items(answers[1]), // the server may not offer it
      trending: trending.length ? { movie: items(answers[2]), series: items(answers[3]) } : { movie: [], series: [] },
      latest: session.libraries.map((library, i) => ({ library, items: items(rest[i]) })),
    };
  }

  // Titles taken out of Continue Watching here, hidden at once.
  let removed = $state<string[]>([]);
  async function forget(item: { id: string }) {
    removed = [...removed, item.id];
    await overfin.forgetProgress(item.id).catch(() => (removed = removed.filter((id) => id !== item.id)));
  }
</script>

{#await load()}
  <Skeleton />
{:then home}
  {@const empty = !home.resume.length && !home.watchlist.length && home.latest.every((l) => !l.items.length)}
  <!-- Without discovery, the slideshow shows the newest, from every
       library in turn. -->
  <Slides trending={home.trending} fallback={home.latest.flatMap((l) => l.items.map((item, i) => ({ item, i })))
    .sort((a, b) => a.i - b.i).map((x) => x.item)} />
  {#if empty}
    <p class="muted">{t('common.nothingYet')}</p>
  {/if}
  <!-- Started titles and next episodes together; only started ones can be
       taken out. -->
  <Row title={t('home.continue')} items={home.resume.filter((i) => !removed.includes(i.id))} wide remove={forget}
    removable={(i) => !!i.userState?.positionMs} />
  <Row title={t('home.watchlist')} items={home.watchlist} />
  {#if session.discovery}
    <DiscoverRow title={t('home.trendingMovies')} list="trending" kind="movie" availability="library" flags={false}
      items={home.trending.movie} />
    <DiscoverRow title={t('home.trendingSeries')} list="trending" kind="series" availability="library" flags={false}
      items={home.trending.series} />
  {/if}
  {#each home.latest as { library, items } (library.id)}
    <Row title={t('home.latest', { library: library.name })} {items} />
  {/each}
{:catch error}
  <PageError {error} />
{/await}
