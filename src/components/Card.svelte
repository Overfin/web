<!-- One title in a row or grid: its poster (or a still, wide), its name,
     and how far the profile got. -->
<script lang="ts">
  import type { ItemSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';

  let { item, wide = false, remove }: { item: ItemSummary; wide?: boolean; remove?: () => void } = $props();

  const image = $derived(wide ? (item.images?.thumb ?? item.images?.backdrops?.[0] ?? item.images?.primary) : item.images?.primary);
  const progress = $derived(item.userState?.positionMs && item.durationMs
    ? Math.min(100, (100 * item.userState.positionMs) / item.durationMs) : 0);
  const sub = $derived.by(() => {
    const e = item.episode;
    if (!e) return item.year ?? '';
    return `${e.seriesName ?? ''} · ${t('item.seasonEpisodeShort', { season: e.seasonNumber ?? '?', episode: e.number ?? '?' })}`;
  });
</script>

<div class="cardbox">
  <a class="card" class:wide href="/item/{item.id}">
    <div class="poster" class:wide>
      {#if image}
        <img src={overfin.imageUrl(image, 'small')} alt="" loading="lazy" />
      {:else}
        <div class="fallback">{item.name}</div>
      {/if}
      {#if progress}
        <div class="progress" style:width="{progress}%"></div>
      {/if}
    </div>
    <div class="title">{item.name}</div>
    <div class="sub">{sub}</div>
  </a>
  {#if remove}
    <button class="remove" type="button" title={t('home.removeFromContinue')} aria-label={t('home.removeFromContinue')}
      onclick={remove}>✕</button>
  {/if}
</div>
