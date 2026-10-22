<!-- Discover: what's trending, popular and upcoming, films and series, with
     what the library has and what it doesn't. -->
<script lang="ts">
  import { t, type Key } from '../lib/i18n.svelte';
  import { replace } from '../lib/router.svelte';
  import DiscoverRow from '../components/DiscoverRow.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import TMDBNotice from '../components/TMDBNotice.svelte';

  let { params }: { params: URLSearchParams } = $props();

  type Show = 'all' | 'library' | 'missing';
  const shows: Show[] = ['all', 'library', 'missing'];
  const showKeys: Record<Show, Key> = { all: 'discover.show.all', library: 'discover.show.library', missing: 'discover.show.missing' };
  const show = $derived<Show>(shows.includes(params.get('show') as Show) ? (params.get('show') as Show) : 'all');

  const rows = [
    { list: 'trending', kind: 'movie', key: 'discover.trendingMovies' },
    { list: 'trending', kind: 'series', key: 'discover.trendingSeries' },
    { list: 'popular', kind: 'movie', key: 'discover.popularMovies' },
    { list: 'popular', kind: 'series', key: 'discover.popularSeries' },
    { list: 'upcoming', kind: 'movie', key: 'discover.upcomingMovies' },
    { list: 'upcoming', kind: 'series', key: 'discover.upcomingSeries' },
  ] as const;

  // How many rows answered, and whether any had titles: "nothing here"
  // only once they all have.
  let answered = $state(0);
  let any = $state(false);
  function found(has: boolean) {
    answered++;
    any ||= has;
  }
</script>

<div class="toolbar">
  <h1>{t('discover.title')}</h1>
  <div class="tabs" role="tablist">
    {#each shows as s (s)}
      <button type="button" role="tab" aria-selected={show === s} class:active={show === s}
        onclick={() => replace(s === 'all' ? '/discover' : `/discover?show=${s}`)}>{t(showKeys[s])}</button>
    {/each}
  </div>
</div>

{#if answered < rows.length && !any}
  <Skeleton />
{:else if answered === rows.length && !any}
  <p class="muted">{t('common.nothingYet')}</p>
{/if}
{#each rows as row (row.key)}
  <DiscoverRow title={t(row.key)} list={row.list} kind={row.kind} availability={show} {found} />
{/each}
<TMDBNotice />
