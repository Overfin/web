<!-- The home page's slideshow: titles in the library that are trending (or,
     without discovery, the newest), each with its backdrop, logo, details
     and what to do. It moves on every few seconds, and holds still while
     the pointer or the keyboard is on it, while the tab is hidden, and when
     the system asks for less motion. Arrows, dots, swipes and the arrow
     keys move it too. -->
<script lang="ts" module>
  // Which slide showed last, and since when: kept while the site is open,
  // so coming back to the home page goes on where the slideshow would be.
  let last: { id: string; since: number } | null = null;
</script>

<script lang="ts">
  import type { Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { duration } from '../lib/format';
  import { t } from '../lib/i18n.svelte';
  import { loaded } from '../lib/loaded';
  import { play } from '../lib/play';

  let { trending, fallback }: { trending: { movie: TitleSummary[]; series: TitleSummary[] }; fallback: TitleSummary[] } = $props();

  const count = 8;
  const every = 8000;

  let slides = $state<Title[]>([]);
  let index = $state(0);
  // How long the slide on show stays: shorter for one resumed midway.
  let wait = $state(0);
  // Slides shown so far, and the next one: only their backdrops load.
  let seen = $state(new Set([0, 1]));
  // Each series' episode to play (the one in progress, the next, or the
  // first), asked for when its slide first shows; null when it has none.
  let episodes = $state<Record<string, { id: string; positionMs: number } | null>>({});
  let hovered = $state(false);
  let focused = $state(false);
  let hidden = $state(false);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** ids picks the titles: trending films and series in turn, else the
   * newest. */
  function ids(): string[] {
    const mixed: string[] = [];
    for (let i = 0; i < count; i++) {
      for (const title of [trending.movie[i], trending.series[i]]) {
        if (title && title.availability !== 'missing') mixed.push(title.id);
      }
    }
    if (mixed.length) return mixed.slice(0, count);
    return fallback.slice(0, count).map((item) => item.id);
  }

  $effect(() => {
    const chosen = ids();
    if (!chosen.length) return;
    // Each title's page, for its overview and genres, in one request; those
    // that fail are left out.
    overfin.batch(chosen.map((id) => `/titles/${encodeURIComponent(id)}`)).then((items) => {
      slides = items.filter((it): it is Title => !(it instanceof Error) && !!it?.images?.backdrops?.[0]);
      resume();
    }, () => {});
  });

  // Where the slideshow would be, had it gone on while away (where it was,
  // when motion is reduced).
  function resume() {
    const at = last ? slides.findIndex((sl) => sl.id === last!.id) : -1;
    // A first visit (or a slide gone from the list) starts anywhere, so
    // the same one doesn't always come first.
    if (!last || at < 0) {
      show(Math.floor(Math.random() * slides.length));
      return;
    }
    if (still) {
      show(at);
      return;
    }
    const away = Date.now() - last.since;
    const i = (at + Math.floor(away / every)) % slides.length;
    const since = Date.now() - (away % every);
    show(i);
    last = { id: slides[i].id, since };
    wait = every - (away % every);
  }

  function show(i: number) {
    if (!slides.length) return;
    index = (i + slides.length) % slides.length;
    seen = new Set([...seen, index, (index + 1) % slides.length]);
    last = { id: slides[index].id, since: Date.now() };
    wait = every;
  }

  $effect(() => {
    const item = slides[index];
    if (!item || item.kind !== 'series' || item.id in episodes) return;
    episodes[item.id] = null;
    overfin.upNext(item.id).then((up) => {
      episodes[item.id] = { id: up.title.id, positionMs: up.positionMs };
    }, () => {});
  });

  $effect(() => {
    if (still || hovered || focused || hidden || slides.length < 2) return;
    const timer = setTimeout(() => show(index + 1), wait || every);
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
            {#if item.certification}<span class="certification">{item.certification}</span>{/if}
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
            {:else if episodes[item.id]}
              {@const ep = episodes[item.id]!}
              <button class="primary" onclick={() => play(ep.id, ep.positionMs)}>
                {ep.positionMs ? t('home.resume') : t('item.play')}
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
