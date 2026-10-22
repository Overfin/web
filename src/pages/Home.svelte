<!-- Home: a slideshow of featured titles, what to continue, what's next, the watchlist, what's trending
     among the library's titles, and what's new in each library (films and
     series only). -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { session } from '../lib/session.svelte';
  import PageError from '../components/PageError.svelte';
  import DiscoverRow from '../components/DiscoverRow.svelte';
  import Row from '../components/Row.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import Slides from '../components/Slides.svelte';

  async function load() {
    const [resume, nextUp, watchlist, latest] = await Promise.all([
      overfin.resume(12),
      overfin.nextUp(12),
      overfin.watchlist().catch(() => []), // the server may not offer it
      Promise.all(session.libraries.map(async (library) => ({ library, items: await overfin.latest(library.id, 16) }))),
    ]);
    return { resume, nextUp, watchlist, latest };
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
  {@const empty = !home.resume.length && !home.nextUp.length && !home.watchlist.length && home.latest.every((l) => !l.items.length)}
  <!-- Without discovery, the slideshow shows the newest, from every
       library in turn. -->
  <Slides fallback={home.latest.flatMap((l) => l.items.map((item, i) => ({ item, i })))
    .sort((a, b) => a.i - b.i).map((x) => x.item)} />
  {#if empty}
    <p class="muted">{t('common.nothingYet')}</p>
  {/if}
  <Row title={t('home.continue')} items={home.resume.filter((i) => !removed.includes(i.id))} wide remove={forget} />
  <Row title={t('home.nextUp')} items={home.nextUp} wide />
  <Row title={t('home.watchlist')} items={home.watchlist} />
  {#if session.discovery}
    <DiscoverRow title={t('home.trendingMovies')} list="trending" kind="movie" availability="library" flags={false} />
    <DiscoverRow title={t('home.trendingSeries')} list="trending" kind="series" availability="library" flags={false} />
  {/if}
  {#each home.latest as { library, items } (library.id)}
    <Row title={t('home.latest', { library: library.name })} {items} />
  {/each}
{:catch error}
  <PageError {error} />
{/await}
