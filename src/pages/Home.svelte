<!-- Home: a slideshow of featured titles, what to continue (next episodes
     included), the watchlist, what's trending (among the library's titles,
     or all of them when the operator says so), what's new in each of the
     operator's home categories, and in each library while the menu shows
     them (films and series only). -->
<script lang="ts" module>
  // The slideshow's random picks: new each time the site opens, the same
  // while browsing it.
  const seed = String(Math.floor(Math.random() * 1e9));
</script>

<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { homeChanged, keepHome, keptHome } from '../lib/homecache';
  import { session } from '../lib/session.svelte';
  import PageError from '../components/PageError.svelte';
  import DiscoverRow from '../components/DiscoverRow.svelte';
  import Row from '../components/Row.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import Slides from '../components/Slides.svelte';

  // Titles no library has, among what's trending and in the slideshow,
  // when the operator wants them there.
  const availability = $derived(session.me?.home?.missingTitles ? 'all' : 'library');

  // What's new: in each home category, then in each library (while the
  // menu shows them).
  const sections = $derived([
    ...session.categories.filter((c) => c.home).map((c) => ({ id: c.id, name: c.name,
      call: ['/titles', { kind: ['movie', 'series'], category: c.id, sort: 'addedAt', order: 'desc', limit: 16 }] as [string, Record<string, string | number | string[]>] })),
    ...(session.librariesShown ? session.libraries : []).map((l) => ({ id: l.id, name: l.name,
      call: ['/titles/latest', { library: l.id, limit: 16 }] as [string, Record<string, string | number | string[]>] })),
  ]);

  // Every row in one request (the server answers each as it would alone).
  async function load() {
    const trending = session.discovery ? (['movie', 'series'] as const) : [];
    const answers = await overfin.batch([
      ['/titles/continue', { limit: 20 }],
      '/me/watchlist',
      ...trending.map((kind): [string, Record<string, string | number>] =>
        ['/discover', { list: 'trending', mediaKind: kind, availability, limit: 20 }]),
      ...sections.map((x) => x.call),
      // What fits the profile: among everything, and among the newest.
      ['/titles/recommended', { scope: 'all', limit: 20 }],
      ['/titles/recommended', { scope: 'recent', limit: 20 }],
      // For the slideshow: the library at random, and its best rated.
      ['/titles', { kind: ['movie', 'series'], sort: 'random', seed, limit: 30 }],
      ['/titles', { kind: ['movie', 'series'], sort: 'communityRating', order: 'desc', limit: 40 }],
    ]);
    // A row that failed is empty; Continue Watching failing fails the page.
    const items = (a: unknown): TitleSummary[] => (a instanceof Error ? [] : (a as { items: TitleSummary[] }).items);
    if (answers[0] instanceof Error) throw answers[0];
    const rest = answers.slice(2 + trending.length, 2 + trending.length + sections.length);
    const [recommended, recent, random, acclaimed] = answers.slice(-4).map(items);
    return {
      random, acclaimed, recommended, recent,
      resume: items(answers[0]),
      watchlist: items(answers[1]), // the server may not offer it
      trending: trending.length ? { movie: items(answers[2]), series: items(answers[3]) } : { movie: [], series: [] },
      latest: sections.map((section, i) => ({ section, items: items(rest[i]) })),
    };
  }

  // What was read last for this profile, in this tab, shows at once; it's
  // read again in the background once a few minutes old, or after a
  // playback or a mark (homecache). The slideshow keeps its picks
  // meanwhile.
  type HomeData = Awaited<ReturnType<typeof load>>;
  const profile = session.me?.activeProfile?.id ?? '';
  const kept = keptHome<HomeData>(profile);
  let home = $state<HomeData | null>(kept?.data ?? null);
  let slides = $state<HomeData | null>(kept?.data ?? null);
  let error = $state<unknown>();
  async function read() {
    try {
      const data = await load();
      home = data;
      slides ??= data;
      keepHome(profile, data);
    } catch (err) {
      if (!home) error = err;
    }
  }
  if (!kept || kept.old) read();

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
  <Slides trending={slides.trending} random={slides.random} acclaimed={slides.acclaimed} recommended={slides.recommended} missing={availability === 'all'} {profile}
    latest={slides.latest.flatMap((l) => l.items.map((item, i) => ({ item, i }))).sort((a, b) => a.i - b.i).map((x) => x.item)} />
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
