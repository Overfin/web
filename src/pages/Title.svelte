<!-- A title from discovery: what it is, and for series each season's place
     in the library. Play when the library has it. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { t, tn, type Key } from '../lib/i18n.svelte';
  import { play } from '../lib/play';
  import PageError from '../components/PageError.svelte';
  import TMDBNotice from '../components/TMDBNotice.svelte';

  let { kind, tmdbId }: { kind: string; tmdbId: string } = $props();

  const placeKey = (a: string): Key => a === 'available' ? 'discover.inLibrary' : a === 'partiallyAvailable' ? 'discover.partly' : 'discover.missing';
</script>

{#if kind !== 'movie' && kind !== 'series'}
  <PageError notFound />
{:else}
  {#await overfin.catalogTitle(kind, tmdbId)}
    <p class="muted">{t('app.loading')}</p>
  {:then title}
    <div class="hero" class:art={!!title.images?.backdrops?.[0]}>
      {#if title.images?.backdrops?.[0]}
        <img class="backdrop" src={overfin.imageUrl(title.images.backdrops[0], 'large')} alt="" />
      {/if}
      <div class="info">
        <div class="poster">
          {#if title.images?.primary}
            <img src={overfin.imageUrl(title.images.primary, 'medium')} alt="" />
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
      <p class="muted">{title.cast.map((c) => c.character ? `${c.name} (${c.character})` : c.name).join(', ')}</p>
    {/if}
    <TMDBNotice />
  {:catch error}
    <PageError {error} />
  {/await}
{/if}
