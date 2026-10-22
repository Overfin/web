<!-- A title from discovery: what it is, and for series each season's place
     in the library. Play when the library has it. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { t, tn, type Key } from '../lib/i18n.svelte';
  import { play } from '../lib/play';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import TMDBNotice from '../components/TMDBNotice.svelte';

  let { kind, tmdbId }: { kind: string; tmdbId: string } = $props();

  const placeKey = (a: string): Key => a === 'available' ? 'discover.inLibrary' : a === 'partiallyAvailable' ? 'discover.partly' : 'discover.missing';
</script>

{#if kind !== 'movie' && kind !== 'series'}
  <PageError notFound />
{:else}
  {#await overfin.catalogTitle(kind, tmdbId)}
    <Skeleton kind="title" />
  {:then title}
    <div class="hero" class:art={!!title.images?.backdrops?.[0]}>
      {#if title.images?.backdrops?.[0]}
        <img class="backdrop" src={overfin.imageUrl(title.images.backdrops[0], 'large')} alt="" use:loaded />
      {/if}
      <div class="info">
        <div class="poster">
          {#if title.images?.primary}
            <img src={overfin.imageUrl(title.images.primary, 'medium')} alt="" use:loaded />
          {/if}
        </div>
        <div>
          <h1>{title.name}</h1>
          <div class="meta">
            {#if title.year}<span>{title.year}</span>{/if}
            {#if title.genres?.length}<span>{title.genres.join(', ')}</span>{/if}
            <span>{t(placeKey(title.availability))}</span>
          </div>
          <div class="actions">
            {#if title.libraryItem}
              {#if kind === 'movie'}
                <button class="primary" onclick={() => play(title.libraryItem!.id, 0)}>{t('item.play')}</button>
              {/if}
              <a class="button" href="/item/{title.libraryItem.id}">{t('discover.openInLibrary')}</a>
            {/if}
          </div>
          {#if title.overview}<p>{title.overview}</p>{/if}
        </div>
      </div>
    </div>
    {#if title.seasons?.length}
      <h2>{t('discover.seasons')}</h2>
      <ul class="plain">
        {#each title.seasons as season (season.number)}
          <li>
            {season.name || t('discover.seasonNumber', { number: season.number })}
            <span class="muted">· {tn('discover.episodes', season.episodeCount)} · {t(placeKey(season.availability))}</span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if title.cast?.length}
      <h2>{t('discover.cast')}</h2>
      <div class="row">
        {#each title.cast as c, i (i)}
          <div class="card">
            <div class="poster">
              {#if c.image}
                <img src={overfin.imageUrl(c.image, 'small')} alt="" loading="lazy" use:loaded />
              {:else}
                <div class="fallback">{c.name}</div>
              {/if}
            </div>
            <div class="title">{c.name}</div>
            <div class="sub">{c.character ?? ''}</div>
          </div>
        {/each}
      </div>
    {/if}
    <TMDBNotice />
  {:catch error}
    <PageError {error} />
  {/await}
{/if}
