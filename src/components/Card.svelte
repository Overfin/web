<!-- One title in a row or grid, in a library or not: its poster (or a still,
     wide), its name, how far the profile got. Hovered or focused, a title
     that can play shows a play button in its corner, and one no library has
     a request button (when the server takes requests); the rest of the card
     opens the title's page. A requested title says where its request is. -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { t, type Key } from '../lib/i18n.svelte';
  import { play } from '../lib/play';
  import { ask } from '../lib/requests';
  import { session } from '../lib/session.svelte';

  let { item, wide = false, flags = true, remove }: {
    item: TitleSummary; wide?: boolean; flags?: boolean; remove?: () => void;
  } = $props();

  const image = $derived(wide ? (item.images?.thumb ?? item.images?.backdrops?.[0] ?? item.images?.primary) : item.images?.primary);
  const position = $derived(item.userState?.positionMs ?? 0);
  const progress = $derived(position && item.durationMs ? Math.min(100, (100 * position) / item.durationMs) : 0);
  const sub = $derived.by(() => {
    if (item.kind === 'episode' && item.series) {
      return `${item.series.name} · ${t('item.seasonEpisodeShort', { season: item.seasonNumber ?? '?', episode: item.episodeNumber ?? '?' })}`;
    }
    if (item.kind === 'season' && item.series) return item.series.name;
    return item.year ?? '';
  });
  // The request covering it: as loaded, then as made here.
  let asked = $state<TitleSummary['request'] | null>(null);
  const request = $derived(asked ?? item.request);
  const askable = $derived(session.requests && !item.playable && item.availability !== 'available' && !request
    && item.kind !== 'other');
  async function requestIt() {
    asked = await ask(item.id);
  }
  const flag = $derived(request && item.availability !== 'available' ? t(`request.status.${request.status}` as Key)
    : !flags ? '' : item.availability === 'missing' ? t('title.notHere')
    : item.availability === 'partiallyAvailable' ? t('discover.partly') : '');
</script>

<div class="cardbox" class:wide>
  <a class="card" class:wide href="/title/{item.id}">
    <div class="poster" class:wide>
      {#if image}
        <img src={overfin.imageUrl(image, 'small')} alt="" loading="lazy" use:loaded />
      {:else}
        <div class="fallback">{item.name}</div>
      {/if}
      {#if progress}
        <div class="progress" style:width="{progress}%"></div>
      {/if}
      {#if flag}<span class="flag">{flag}</span>{/if}
      {#if item.userState?.played}<span class="seen" aria-label={t('title.watched')}>✓</span>{/if}
    </div>
    <div class="title">{item.name}</div>
    <div class="sub">{sub}</div>
  </a>
  {#if item.playable}
    <button class="act" type="button" aria-label={t('item.play') + ' : ' + item.name}
      onclick={() => play(item.id, position)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
    </button>
  {/if}
  {#if askable}
    <button class="act ask" type="button" aria-label={t('request.ask') + ' : ' + item.name} title={t('request.ask')}
      onclick={requestIt}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v8.2l3.1-3.1 1.4 1.4L12 16l-5.5-5.5 1.4-1.4L11 12.2zM5 18h14v2H5z" /></svg>
    </button>
  {/if}
  {#if remove}
    <button class="remove" type="button" title={t('home.removeFromContinue')} aria-label={t('home.removeFromContinue')}
      onclick={remove}>✕</button>
  {/if}
</div>
