<!-- One of the rows' lists, whole, as a grid loaded page by page as the
     person scrolls: a discovery list (trending, popular or upcoming,
     films or series, the available titles or the missing ones, as the
     row it came from), or the profile's recommendations (among
     everything, or among the newest). Titled as its row. What was read
     of it in this tab, as far as it was scrolled, shows at once when it's
     opened again (pagecache). -->
<script lang="ts">
  import { tick } from 'svelte';
  import type { TitlePage, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { forgetList, keepList, keptList } from '../lib/pagecache';
  import { t, type Key } from '../lib/i18n.svelte';
  import type { DiscoverAvailability, DiscoverKind, DiscoverList } from '../lib/paths';
  import { session } from '../lib/session.svelte';
  import { visible } from '../lib/visible';
  import { landed } from '../lib/warm';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  type Source =
    | { discover: { list: DiscoverList; kind: DiscoverKind; availability: DiscoverAvailability } }
    | { recommended: 'all' | 'recent' };
  let { source }: { source: Source } = $props();

  // The row's own title: Home's for its trending rows, Discover's for the
  // missing titles, Home's for the recommendations.
  const titles: Record<string, Key> = {
    'trending:movie:home': 'home.trendingMovies', 'trending:series:home': 'home.trendingSeries',
    'trending:movie': 'discover.trendingMovies', 'trending:series': 'discover.trendingSeries',
    'popular:movie': 'discover.popularMovies', 'popular:series': 'discover.popularSeries',
    'upcoming:movie': 'discover.upcomingMovies', 'upcoming:series': 'discover.upcomingSeries',
  };
  // svelte-ignore state_referenced_locally
  const title = 'discover' in source
    ? t(titles[`${source.discover.list}:${source.discover.kind}${source.discover.availability !== 'missing' && titles[`${source.discover.list}:${source.discover.kind}:home`] ? ':home' : ''}`])
    : t(source.recommended === 'recent' ? 'home.recentForYou' : 'home.recommended');
  // Titles no library has carry their marks only among all of them, as
  // on Home.
  // svelte-ignore state_referenced_locally
  const flags = 'discover' in source && source.discover.availability === 'all';

  // Each page after the other.
  async function* read(): AsyncGenerator<TitlePage> {
    let cursor: string | undefined;
    do {
      const page: TitlePage = 'discover' in source
        ? await overfin.discover(source.discover.list, source.discover.kind, { availability: source.discover.availability, limit: 40, cursor })
        : await overfin.recommendedPage(source.recommended, { limit: 50, cursor });
      yield page;
      cursor = page.nextCursor;
    } while (cursor);
  }

  type Kept = { items: TitleSummary[]; finished: boolean; pages?: AsyncGenerator<TitlePage> };
  // svelte-ignore state_referenced_locally
  const listKey = `${session.me?.activeProfile?.id}:titles:${JSON.stringify(source)}`;
  const kept = keptList<Kept>(listKey);
  let items = $state<TitleSummary[]>(kept?.items ?? []);
  let finished = $state(kept?.finished ?? false);
  let error = $state<unknown>();
  let sentinel = $state<HTMLElement>();
  let loading = false;
  let pages: AsyncGenerator<TitlePage> | undefined = kept?.pages;

  async function more() {
    if (loading || finished) return;
    pages ??= read();
    loading = true;
    try {
      const { value: page, done } = await pages.next();
      if (done) {
        finished = true;
      } else {
        // A title already here (a list changing between two pages) isn't
        // shown twice: the grid is keyed by ID.
        const shown = new Set(items.map((i) => i.id));
        items.push(...page.items.filter((i) => !shown.has(i.id)));
        if (!page.nextCursor) finished = true;
      }
      keepList(listKey, { items: $state.snapshot(items), finished, pages });
    } catch (err) {
      error = err;
      finished = true;
      forgetList(listKey);
    } finally {
      loading = false;
    }
    // Still room on screen: the next page right away.
    await tick();
    if (!finished && sentinel && sentinel.getBoundingClientRect().top < innerHeight * 2) more();
  }
  // svelte-ignore state_referenced_locally
  if (!items.length && !finished) more().then(landed);
  else landed();
</script>

<h1>{title}</h1>
<div class="grid">
  {#each items as item (item.id)}
    <Card {item} {flags} />
  {/each}
</div>
{#if !items.length && !finished}
  <Skeleton kind="grid" />
{/if}
{#if finished && !items.length && !error}
  <p class="muted">{t('common.nothingYet')}</p>
{/if}
{#if error}
  <PageError {error} />
{:else if !finished}
  <div bind:this={sentinel} use:visible={more}></div>
{/if}
