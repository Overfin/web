<!-- A category's genres, behind one button by its name: the chosen genre,
     or all of them. Its list opens in columns, as many as fit (two on a
     phone), however many genres there are; it closes with a tap outside,
     Escape, or a genre picked (another address). -->
<script lang="ts">
  import type { Genre } from '../lib/sdk/overfin.js';
  import { t } from '../lib/i18n.svelte';

  let { base, genres, genre }: { base: string; genres: Genre[]; genre: string } = $props();

  let open = $state(false);
  let box: HTMLDivElement;
  let toggle: HTMLButtonElement;
  // The most titles first.
  const sorted = $derived([...genres].sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0)));

  function outside(event: MouseEvent) {
    if (open && !box.contains(event.target as Node)) open = false;
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      open = false;
      toggle.focus();
    }
  }
</script>

<svelte:window onclick={outside} onkeydown={keydown} />

<div class="genre-menu" bind:this={box}>
  <button type="button" bind:this={toggle} aria-expanded={open} aria-controls="genres" onclick={() => (open = !open)}>
    {genre || t('library.genre.all')}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  </button>
  {#if open}
    <nav id="genres" class="dropdown" aria-label={t('library.genre')}>
      <a href={base} class:active={!genre} aria-current={!genre ? 'page' : undefined} onclick={() => (open = false)}>{t('library.genre.all')}</a>
      {#each sorted as g (g.name)}
        <a href="{base}?genre={encodeURIComponent(g.name)}" class:active={genre === g.name} aria-current={genre === g.name ? 'page' : undefined}
          onclick={() => (open = false)}>{g.name}</a>
      {/each}
    </nav>
  {/if}
</div>
