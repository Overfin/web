<!-- One title in a row or grid, in a library or not: its poster (or a still,
     wide), its name, how far the profile got. Hovered or focused, a title
     that can play (a series a library has too) shows a play button in its
     corner, and a film or a season no library has whole a wishlist button
     (when the server offers wishlists); the rest of the card opens the
     title's page (an episode not here yet, its series': its own page would
     have nothing to play). One on the wishlist says so. One not out yet (a
     collection's) says so, and has neither. -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { sizes, srcset } from '../lib/images';
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { t } from '../lib/i18n.svelte';
  import { play } from '../lib/play';
  import { loadWishes, toggleWish, wishable, wishes } from '../lib/wishlist.svelte';
  import { titlePathOf } from '../lib/paths';
  import { prefetchTitle } from '../lib/titlecache';

  let { item, wide = false, flags = true, note = '', remove, removeLabel }: {
    item: TitleSummary; wide?: boolean; flags?: boolean; note?: string; remove?: () => void; removeLabel?: string;
  } = $props();

  const image = $derived(wide ? (item.images?.thumb ?? item.images?.backdrops?.[0] ?? item.images?.primary) : item.images?.primary);
  const position = $derived(item.userState?.positionMs ?? 0);
  const progress = $derived(position && item.durationMs ? Math.min(100, (100 * position) / item.durationMs) : 0);
  const sub = $derived.by(() => {
    if (item.kind === 'episode' && item.series) {
      return `${item.series.name} · ${t('item.seasonEpisodeShort', { season: item.seasonNumber ?? '?', episode: item.episodeNumber ?? '?' })}`;
    }
    if (item.kind === 'season' && item.series) return item.series.name;
    return [item.year, note].filter(Boolean).join(' · ');
  });
  // A series a library has plays too: the episode the server picks (in
  // progress, the next one, or the first).
  const series = $derived(item.kind === 'series' && item.availability !== 'missing');
  async function start() {
    if (!series) {
      play(item.id, position);
      return;
    }
    const up = await overfin.upNext(item.id).catch(() => null);
    if (up) play(up.title.id, up.positionMs);
  }
  // The wishlist, for a film or a season (a series' are on its page).
  loadWishes();
  const wishing = $derived(!series && !item.upcoming && (item.kind === 'movie' || item.kind === 'season') && wishable(item));
  const wished = $derived(!!wishes.ids[item.id]);
  const flag = $derived(item.upcoming ? t('item.upcoming')
    : wished ? t('wish.on')
    : !flags ? '' : item.availability === 'missing' ? t('title.notHere')
    : item.availability === 'partiallyAvailable' ? t('discover.partly') : '');

  // Where the card leads: an episode not here yet (Continue Watching's
  // next one) opens its series, whose page lists what's coming.
  const target = $derived(item.kind === 'episode' && item.availability === 'missing' && item.series
    ? { id: item.series.id, name: item.series.name } : item);

  // Its page read ahead: once the pointer rests on it a moment, or a finger
  // touches it, so opening it shows at once.
  let timer: ReturnType<typeof setTimeout> | undefined;
  function soon() {
    timer = setTimeout(() => prefetchTitle(target.id), 120);
  }
  function cancel() {
    clearTimeout(timer);
  }
  // Nothing read ahead once the card is gone.
  $effect(() => cancel);
</script>

<div class="cardbox" class:wide>
  <svelte:element this={item.upcoming ? 'div' : 'a'} class="card" class:wide href={item.upcoming ? undefined : titlePathOf(target)}
    onpointerenter={item.upcoming ? undefined : soon} onpointerleave={cancel} role={item.upcoming ? 'group' : undefined}
    ontouchstart={() => !item.upcoming && prefetchTitle(target.id)} onfocus={() => !item.upcoming && prefetchTitle(target.id)}>
    <div class="poster" class:wide>
      {#if image}
        <img src={overfin.imageUrl(image, 'small')} srcset={srcset(image, wide ? 'backdrop' : 'poster')} sizes={wide ? sizes.wideCard : sizes.card} alt="" loading="lazy" use:loaded />
      {:else}
        <div class="fallback">{item.name}</div>
      {/if}
      {#if progress}
        <div class="progress" style:width="{progress}%"></div>
      {/if}
      {#if flag}<span class="flag">{flag}</span>{/if}
      {#if item.userState?.played}<span class="seen" role="img" aria-label={t('title.watched')}>✓</span>{/if}
    </div>
    <div class="title">{item.name}</div>
    <div class="sub">{sub}</div>
  </svelte:element>
  {#if item.playable || series}
    <button class="act" type="button" aria-label={t('item.play') + ' : ' + item.name}
      onclick={start}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
    </button>
  {/if}
  {#if wishing}
    <button class="act ask" class:on={wished} type="button" aria-pressed={wished}
      aria-label={(wished ? t('wish.on') : t('wish.add')) + ' : ' + item.name} title={wished ? t('wish.on') : t('wish.add')}
      onclick={() => toggleWish(item)}>
      {#if wished}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8zm0 4.3l-1.6 3.4-3.7.5 2.7 2.6-.7 3.7 3.3-1.8 3.3 1.8-.7-3.7 2.7-2.6-3.7-.5z" fill-rule="evenodd" /></svg>
      {/if}
    </button>
  {/if}
  {#if remove}
    <button class="remove" type="button" title={removeLabel ?? t('home.removeFromContinue')}
      aria-label={removeLabel ?? t('home.removeFromContinue')}
      onclick={remove}>✕</button>
  {/if}
</div>
