<!-- A row that scrolls sideways. With a mouse, arrow buttons at its ends
     scroll it most of a screen at a time, and it shows no scrollbar; touch
     screens swipe it, and keyboards and remotes move along its cards. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../lib/i18n.svelte';

  let { children }: { children: Snippet } = $props();

  let row: HTMLDivElement;
  let atStart = $state(true);
  let atEnd = $state(false);

  // Which ends there's more beyond: checked as it scrolls, and as the
  // pointer comes, since its cards may have arrived meanwhile.
  function update() {
    atStart = row.scrollLeft <= 4;
    atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  }

  function by(direction: number) {
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' });
  }

  $effect(() => {
    update();
    const resized = new ResizeObserver(update);
    resized.observe(row);
    return () => resized.disconnect();
  });
</script>

<div class="scroller" role="presentation" onmouseenter={update}>
  <div class="row" bind:this={row} onscroll={update}>
    {@render children()}
  </div>
  <button class="shift prev" type="button" tabindex="-1" aria-label={t('home.previous')} hidden={atStart} onclick={() => by(-1)}>‹</button>
  <button class="shift next" type="button" tabindex="-1" aria-label={t('home.next')} hidden={atEnd} onclick={() => by(1)}>›</button>
</div>
