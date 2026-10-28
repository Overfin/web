<!-- Home: a slideshow of featured titles, what to continue (next episodes
     included), the watchlist, what's trending (among the library's titles,
     or all of them when the operator says so), what's new in each of the
     operator's home categories, and in each library while the menu shows
     them (films and series only). -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { homeChanged, keepHome, keptHome } from '../lib/homecache';
  import { homeAvailability, loadHome, type HomeData } from '../lib/homeload';
  import { session } from '../lib/session.svelte';
  import { slideSources } from '../lib/slides';
  import { landed } from '../lib/warm';
  import PageError from '../components/PageError.svelte';
  import DiscoverRow from '../components/DiscoverRow.svelte';
  import Row from '../components/Row.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import Slides from '../components/Slides.svelte';

  // Titles no library has, among what's trending and in the slideshow,
  // when the operator wants them there.
  const availability = $derived(homeAvailability());

  // What was read last for this profile, in this tab, shows at once; it's
  // read again in the background once a few minutes old, or after a
  // playback or a mark (homecache). The slideshow keeps its picks
  // meanwhile.
  const profile = session.me?.activeProfile?.id ?? '';
  const kept = keptHome<HomeData>(profile);
  let home = $state<HomeData | null>(kept?.data ?? null);
  let slides = $state<HomeData | null>(kept?.data ?? null);
  let error = $state<unknown>();
  async function read() {
    const asked = Date.now();
    try {
      const data = await loadHome();
      home = data;
      slides ??= data;
      keepHome(profile, data, asked);
    } catch (err) {
      if (!home) error = err;
    }
    landed();
  }
  if (!kept || kept.old) read();
  else landed();

  // Titles taken out of Continue Watching here, hidden at once.
  let removed = $state<string[]>([]);
  async function forget(item: { id: string }) {
    homeChanged();
    removed = [...removed, item.id];
    await overfin.forgetProgress(item.id).catch(() => (removed = removed.filter((id) => id !== item.id)));
  }
</script>

{#if home && slides}
  <!-- Nothing yet: no row at all, trending ones included. -->
  {@const empty = !home.resume.length && !home.watchlist.length && home.latest.every((l) => !l.items.length)
    && !home.trending.movie.length && !home.trending.series.length}
  <!-- Without discovery, the slideshow shows the newest, from every
       library in turn. -->
  <Slides {...slideSources(slides, availability === 'all')} {profile} />
  {#if empty}
    <p class="muted">{t('common.nothingYet')}</p>
  {/if}
  <!-- Started titles and next episodes together; any can be taken out
       (a series' until it's watched again). -->
  <Row title={t('home.continue')} items={home.resume.filter((i) => !removed.includes(i.id))} wide remove={forget} />
  <Row title={t('home.watchlist')} items={home.watchlist} />
  <Row title={t('home.recommended')} items={home.recommended} />
  <Row title={t('home.recentForYou')} items={home.recent} />
  {#if session.discovery}
    <DiscoverRow title={t('home.trendingMovies')} list="trending" kind="movie" {availability} flags={availability === 'all'}
      items={home.trending.movie} />
    <DiscoverRow title={t('home.trendingSeries')} list="trending" kind="series" {availability} flags={availability === 'all'}
      items={home.trending.series} />
  {/if}
  {#each home.latest as { section, items } (section.id)}
    <Row title={t('home.latest', { library: section.name })} {items} />
  {/each}
{:else if error}
  <PageError {error} />
{:else}
  <Skeleton kind="home" />
{/if}
