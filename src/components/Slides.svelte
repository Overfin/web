<!-- The home page's slideshow: titles in the library that are trending (or,
     without discovery, the newest), each with its backdrop, logo, details
     and what to do. It moves on every few seconds, and holds still while
     the pointer or the keyboard is on it, while the tab is hidden, and when
     the system asks for less motion. Arrows, dots, swipes and the arrow
     keys move it too. -->
<script lang="ts">
  import type { Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { duration } from '../lib/format';
  import { t } from '../lib/i18n.svelte';
  import { loaded } from '../lib/loaded';
  import { play } from '../lib/play';
  import { session } from '../lib/session.svelte';

  let { fallback }: { fallback: TitleSummary[] } = $props();

  const count = 8;
  const every = 8000;

  let slides = $state<Title[]>([]);
  let index = $state(0);
  // Slides shown so far, and the next one: only their backdrops load.
  let seen = $state(new Set([0, 1]));
  let hovered = $state(false);
  let focused = $state(false);
  let hidden = $state(false);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** ids picks the titles: trending films and series in turn, else the
   * newest. */
  async function ids(): Promise<string[]> {
    if (session.discovery) {
      const [films, series] = await Promise.all((['movie', 'series'] as const).map((kind) =>
        overfin.discover('trending', kind, { availability: 'library', limit: count }).then((p) => p.items, () => [])));
      const mixed: string[] = [];
      for (let i = 0; i < count; i++) {
        for (const title of [films[i], series[i]]) {
          if (title && title.availability !== 'missing') mixed.push(title.id);
        }
      }
      if (mixed.length) return mixed.slice(0, count);
    }
    return fallback.slice(0, count).map((item) => item.id);
  }

  $effect(() => {
    ids().then(async (chosen) => {
      // Each title's page, for its overview and genres; those that fail
      // are left out.
      const items = await Promise.all(chosen.map((id) => overfin.title(id).catch(() => null)));
      slides = items.filter((it): it is Title => !!it?.images?.backdrops?.[0]);
    });
  });

  function show(i: number) {
    if (!slides.length) return;
    index = (i + slides.length) % slides.length;
    seen = new Set([...seen, index, (index + 1) % slides.length]);
  }

  $effect(() => {
    if (still || hovered || focused || hidden || slides.length < 2) return;
    const timer = setTimeout(() => show(index + 1), every);
    return () => clearTimeout(timer);
  });

  let startX = 0;
  function swipeStart(event: PointerEvent) {
    startX = event.clientX;
  }
  function swipeEnd(event: PointerEvent) {
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') show(index + 1);
    else if (event.key === 'ArrowLeft') show(index - 1);
    else return;
    event.preventDefault();
  }
</script>

<svelte:document onvisibilitychange={() => (hidden = document.hidden)} />

{#if slides.length}
  <!-- Keys reach it from its own buttons and links: the arrows move it. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section class="slides" aria-roledescription="carousel" aria-label={t('home.featured')}
    onmouseenter={() => (hovered = true)} onmouseleave={() => (hovered = false)}
    onfocusin={() => (focused = true)} onfocusout={() => (focused = false)}
    onpointerdown={swipeStart} onpointerup={swipeEnd} onkeydown={keydown}>
    {#each slides as item, i (item.id)}
      {@const position = item.userState?.positionMs ?? 0}
      <div class="slide" class:current={i === index} aria-roledescription="slide" aria-hidden={i !== index} inert={i !== index}
        aria-label={t('home.slide', { n: i + 1, total: slides.length })}>
        {#if seen.has(i)}
          <img class="backdrop" src={overfin.imageUrl(item.images!.backdrops![0], 'large')} alt="" use:loaded />
        {/if}
        <div class="content">
          {#if item.images?.logo}
            <img class="logo" src={overfin.imageUrl(item.images.logo, 'medium')} alt={item.name} />
          {:else}
            <h2>{item.name}</h2>
          {/if}
          <div class="meta">
            {#if item.year}<span>{item.year}</span>{/if}
            {#if item.durationMs && item.kind === 'movie'}<span>{duration(item.durationMs)}</span>{/if}
            {#if item.genres?.length}<span>{item.genres.slice(0, 3).join(', ')}</span>{/if}
          </div>
          {#if item.overview}<p class="overview">{item.overview}</p>{/if}
          <div class="actions">
            {#if item.playable}
              <button class="primary" onclick={() => play(item.id, position)}>
                {position ? t('home.resume') : t('item.play')}
              </button>
              <a class="button" href="/title/{item.id}">{t('home.moreInfo')}</a>
            {:else}
              <a class="button primary" href="/title/{item.id}">{t('home.seeSeries')}</a>
            {/if}
          </div>
        </div>
      </div>
    {/each}
    {#if slides.length > 1}
      <button class="nav prev" type="button" aria-label={t('home.previous')} onclick={() => show(index - 1)}>‹</button>
      <button class="nav next" type="button" aria-label={t('home.next')} onclick={() => show(index + 1)}>›</button>
      <div class="dots">
        {#each slides as item, i (item.id)}
          <button type="button" class:current={i === index} aria-label={t('home.slide', { n: i + 1, total: slides.length })}
            aria-current={i === index} onclick={() => show(i)}></button>
        {/each}
      </div>
    {/if}
  </section>
{/if}
