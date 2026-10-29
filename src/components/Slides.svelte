<!-- The home page's slideshow: a mix of the library's titles, each with its
     backdrop, logo, details and what to do: most among those that fit the
     profile best, some trending, some newly added, some of the best rated,
     and the rest at random, all within
     what the profile may see. It moves on every few seconds, and holds still while
     the pointer or the keyboard is on it, while the tab is hidden, and when
     the system asks for less motion. Arrows, dots, swipes and the arrow
     keys move it too. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { backdropOf } from '../lib/backdrop.svelte';
  import type { Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { ageText, duration } from '../lib/format';
  import { t } from '../lib/i18n.svelte';
  import { keepSlides, keptSlides } from '../lib/homecache';
  import { score } from '../lib/score';
  import { weigh } from '../lib/weigh';
  import { play } from '../lib/play';
  import { titlePathOf } from '../lib/paths';
  import { pickSlides } from '../lib/slides';
  import ButtonIcon from './ButtonIcon.svelte';
  import Marks from './Marks.svelte';

  // missing: trending titles no library has may be shown too, to be
  // requested from their page.
  let { trending, latest, random, acclaimed, recommended = [], missing = false, profile = '' }: {
    trending: { movie: TitleSummary[]; series: TitleSummary[] };
    latest: TitleSummary[]; random: TitleSummary[]; acclaimed: TitleSummary[]; recommended?: TitleSummary[];
    /** profile keeps the slideshow as it was left, for this tab. */
    profile?: string;
    missing?: boolean;
  } = $props();

  const every = 8000;

  let slides = $state<Title[]>([]);
  // Until the titles are there, the slideshow keeps its place.
  let pending = $state(true);
  let index = $state(0);
  // Slides shown so far, and the next one: only their backdrops load.
  let seen = $state(new Set([0, 1]));
  // Each series' episode to play (the one in progress, the next, or the
  // first), asked for when its slide first shows; null when it has none.
  let episodes = $state<Record<string, { id: string; positionMs: number } | null>>({});
  let hovered = $state(false);
  let focused = $state(false);
  let hidden = $state(false);
  // Scrolled out of view.
  let away = $state(false);
  function inView(node: HTMLElement, report: (on: boolean) => void) {
    const observer = new IntersectionObserver((entries) => report(entries[0]?.isIntersecting ?? true));
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    // Shown before in this tab: as it was left.
    const kept = keptSlides<Title>(profile);
    if (kept) {
      untrack(() => {
        slides = kept.titles;
        pending = false;
        show(kept.index);
      });
      return;
    }
    // Each title's page, for its overview and genres; those that fail are
    // left out (slides).
    pickSlides({ trending, latest, random, acclaimed, recommended, missing }).then((picked) => {
      slides = picked;
      keepSlides(profile, slides, 0);
      pending = false;
      // The mix is new each time: it starts at its first slide.
      show(0);
    }, () => (pending = false));
  });

  function show(i: number) {
    if (!slides.length) return;
    index = (i + slides.length) % slides.length;
    keepSlides(profile, slides, index);
    seen = new Set([...seen, index, (index + 1) % slides.length]);
  }

  $effect(() => {
    const item = slides[index];
    if (!item || item.kind !== 'series' || item.availability === 'missing' || item.id in episodes) return;
    episodes[item.id] = null;
    overfin.upNext(item.id).then((up) => {
      episodes[item.id] = { id: up.title.id, positionMs: up.positionMs };
    }, () => {});
  });

  $effect(() => {
    if (still || hovered || focused || hidden || away || slides.length < 2) return;
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

{#if pending}
  <div class="slides loading" aria-hidden="true">
    <div class="content">
      <div class="line logo"></div>
      <div class="line short"></div>
      <div class="line"></div>
      <div class="line buttons"></div>
    </div>
  </div>
{:else if slides.length}
  <!-- Keys reach it from its own buttons and links: the arrows move it. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- The current slide's backdrop is the page's (lib/backdrop); out of
       view, the slideshow holds still, and so does the backdrop. -->
  <section class="slides" aria-roledescription="carousel" aria-label={t('home.featured')}
    use:backdropOf={slides[index]?.images?.backdrops?.[0] ? {
      wide: overfin.imageUrl(slides[index].images!.backdrops![0], 'large'),
      tall: slides[index].images?.textless ? overfin.imageUrl(slides[index].images!.textless!, 'large') : undefined,
    } : undefined}
    use:inView={(on) => (away = !on)}
    onmouseenter={() => (hovered = true)} onmouseleave={() => (hovered = false)}
    onfocusin={() => (focused = true)} onfocusout={() => (focused = false)}
    onpointerdown={swipeStart} onpointerup={swipeEnd} onkeydown={keydown}>
    {#each slides as item, i (item.id)}
      {@const position = item.userState?.positionMs ?? 0}
      <div class="slide" class:current={i === index} aria-roledescription="slide" aria-hidden={i !== index} inert={i !== index}
        aria-label={t('home.slide', { n: i + 1, total: slides.length })}>
        <div class="content">
          {#if item.images?.logo}
            <img class="logo" src={overfin.imageUrl(item.images.logo, 'medium')} alt={item.name} use:weigh />
          {:else}
            <h2>{item.name}</h2>
          {/if}
          <div class="meta">
            {#if item.year}<span>{item.year}</span>{/if}
            {#if ageText(item.age)}<span class="age">{ageText(item.age)}</span>{/if}
            {#if score(item)}{@const s = score(item)!}
              <span class="score" title={t('item.score', { value: s.value, votes: s.votes.toLocaleString() })}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>{s.value}
                <span class="sr-only">{t('item.score', { value: s.value, votes: s.votes.toLocaleString() })}</span>
              </span>
            {/if}
            {#if item.durationMs && item.kind === 'movie'}<span>{duration(item.durationMs)}</span>{/if}
            {#if item.genres?.length}<span>{item.genres.slice(0, 3).join(', ')}</span>{/if}
          </div>
          {#if item.overview}<p class="overview">{item.overview}</p>{/if}
          <div class="actions">
            {#if item.availability === 'missing'}
              <a class="button primary" href={titlePathOf(item)}><ButtonIcon name="info" />{t('home.moreInfo')}</a>
            {:else if item.playable}
              <!-- Where the profile left off as the server says it: a kept
                   slideshow's titles may be from before a playback. -->
              <button class="primary" onclick={() => play(item.id)}>
                <ButtonIcon name="play" />{position ? t('home.resume') : t('item.play')}
              </button>
              <a class="button toggle" href={titlePathOf(item)} aria-label={t('home.moreInfo')} title={t('home.moreInfo')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></svg>
              </a>
              {#if seen.has(i)}<Marks id={item.id} played={item.userState?.played} favorite={item.userState?.favorite} />{/if}
            {:else if episodes[item.id]}
              {@const ep = episodes[item.id]!}
              <button class="primary" onclick={() => play(ep.id, ep.positionMs)}>
                <ButtonIcon name="play" />{ep.positionMs ? t('home.resume') : t('item.play')}
              </button>
              <a class="button toggle" href={titlePathOf(item)} aria-label={t('home.moreInfo')} title={t('home.moreInfo')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></svg>
              </a>
              {#if seen.has(i)}<Marks id={item.id} played={item.userState?.played} favorite={item.userState?.favorite} />{/if}
            {:else}
              <a class="button primary" href={titlePathOf(item)}><ButtonIcon name="info" />{t('home.seeSeries')}</a>
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
