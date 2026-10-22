<!-- A title: its poster and backdrop, what it is, playing it, the watchlist,
     its seasons or episodes, and who made it. -->
<script lang="ts">
  import type { Item, ItemSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { clock, duration } from '../lib/format';
  import { t } from '../lib/i18n.svelte';
  import { play } from '../lib/play';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import PersonCard from '../components/PersonCard.svelte';

  let { id }: { id: string } = $props();

  const playable = new Set(['movie', 'episode', 'video', 'musicVideo']);
  // Movies, whole shows, seasons or single episodes, as the person chooses.
  const listable = new Set(['movie', 'series', 'season', 'episode', 'video', 'musicVideo']);

  async function load(): Promise<{ item: Item; children: ItemSummary[]; childKind: string }> {
    const item = await overfin.item(id);
    if (item.kind !== 'series' && item.kind !== 'season') return { item, children: [], childKind: '' };
    const childKind = item.kind === 'series' ? 'season' : 'episode';
    const { items } = await overfin.items({ parent: item.id, kind: childKind, sort: 'name', limit: 100 });
    return { item, children: items, childKind };
  }

  let onList = $state<boolean | null>(null);
  $effect(() => {
    onList = null;
    overfin.onWatchlist(id).then((on) => (onList = on)).catch(() => {}); // not offered here
  });

  async function toggleList() {
    onList = !onList;
    await (onList ? overfin.addToWatchlist(id) : overfin.removeFromWatchlist(id));
  }

  // Watched and favorite, as the profile marks them: what the server says
  // back replaces what the page loaded.
  let marks = $state<{ played?: boolean; favorite?: boolean }>({});
  async function togglePlayed(now: boolean) {
    marks.played = (await overfin.setPlayed(id, !now)).played;
  }
  async function toggleFavorite(now: boolean) {
    marks.favorite = (await overfin.setFavorite(id, !now)).favorite;
  }
</script>

{#await load()}
  <p class="muted">{t('app.loading')}</p>
{:then { item, children, childKind }}
  {@const position = item.userState?.positionMs ?? 0}
  {@const cast = (item.credits ?? []).filter((c) => c.role === 'actor' || c.role === 'guestStar').slice(0, 20)}
  {@const crew = (item.credits ?? []).filter((c) => c.role === 'director' || c.role === 'writer')}
  <div class="hero" class:art={!!item.images?.backdrops?.[0]}>
    {#if item.images?.backdrops?.[0]}
      <img class="backdrop" src={overfin.imageUrl(item.images.backdrops[0], 'large')} alt="" />
    {/if}
    <div class="info">
      <div class="poster">
        {#if item.images?.primary}
          <img src={overfin.imageUrl(item.images.primary, 'medium')} alt="" />
        {/if}
      </div>
      <div>
        <h1>{item.name}</h1>
        {#if item.episode}
          <p>
            <a href="/item/{item.episode.seriesId}">{item.episode.seriesName || t('common.series')}</a>
            · {t('item.seasonEpisode', { season: item.episode.seasonNumber ?? '?', episode: item.episode.number ?? '?' })}
          </p>
        {:else if item.season}
          <p><a href="/item/{item.season.seriesId}">{item.season.seriesName || t('common.series')}</a></p>
        {/if}
        <div class="meta">
          {#if item.year}<span>{item.year}</span>{/if}
          {#if item.officialRating}<span>{item.officialRating}</span>{/if}
          {#if item.durationMs}<span>{duration(item.durationMs)}</span>{/if}
          {#if item.communityRating}<span>★ {item.communityRating.toFixed(1)}</span>{/if}
          {#if item.genres?.length}<span>{item.genres.join(', ')}</span>{/if}
        </div>
        <div class="actions">
          {#if playable.has(item.kind)}
            {#if position}
              <button class="primary" onclick={() => play(item.id, position)}>{t('item.resumeFrom', { time: clock(position) })}</button>
              <button onclick={() => play(item.id, 0)}>{t('item.fromStart')}</button>
            {:else}
              <button class="primary" onclick={() => play(item.id, 0)}>{t('item.play')}</button>
            {/if}
          {/if}
          {#if listable.has(item.kind) && onList !== null}
            <button onclick={toggleList}>{onList ? t('item.watchlistOn') : t('item.watchlistAdd')}</button>
          {/if}
          {#if listable.has(item.kind)}
            {@const played = marks.played ?? item.userState?.played ?? false}
            {@const favorite = marks.favorite ?? item.userState?.favorite ?? false}
            <button onclick={() => togglePlayed(played)}>{played ? t('item.markUnwatched') : t('item.markWatched')}</button>
            <button onclick={() => toggleFavorite(favorite)}>{favorite ? t('item.favoriteOn') : t('item.favoriteAdd')}</button>
          {/if}
        </div>
        {#if item.overview}<p>{item.overview}</p>{/if}
      </div>
    </div>
  </div>

  {#if children.length}
    <h2>{childKind === 'season' ? t('item.seasons') : t('item.episodes')}</h2>
    <div class={childKind === 'season' ? 'row' : 'grid'}>
      {#each children as child (child.id)}
        <Card item={child} wide={childKind === 'episode'} />
      {/each}
    </div>
  {/if}
  {#if cast.length}
    <h2>{t('item.cast')}</h2>
    <div class="row">
      {#each cast as credit (credit.person.id + (credit.character ?? ''))}
        <PersonCard person={credit.person} sub={credit.character} />
      {/each}
    </div>
  {/if}
  {#if crew.length}
    <p class="muted">
      {#each crew as credit, i (credit.person.id + credit.role)}
        {i ? ' · ' : ''}{credit.role === 'director' ? t('item.directedBy') : t('item.writtenBy')}
        <a href="/person/{credit.person.id}">{credit.person.name}</a>
      {/each}
    </p>
  {/if}
{:catch error}
  <PageError {error} />
{/await}
