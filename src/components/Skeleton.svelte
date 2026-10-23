<!-- What a screen will look like, while it loads: the home page's
     slideshow and rows, a title's top, rows of cards, a grid, or a list of
     panels. Screen readers hear "Loading…". -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';

  let { kind = 'rows' }: { kind?: 'home' | 'title' | 'rows' | 'grid' | 'list' } = $props();
  const cards = Array.from({ length: 12 }, (_, i) => i);
</script>

<div class="skeleton" role="status">
  <span class="sr-only">{t('app.loading')}</span>
  {#if kind === 'home'}
    <!-- The slideshow's place, so nothing moves when it comes. -->
    <div class="slides loading">
      <div class="content">
        <div class="line logo"></div>
        <div class="line short"></div>
        <div class="line"></div>
        <div class="line buttons"></div>
      </div>
    </div>
  {/if}
  {#if kind === 'title'}
    <div class="hero art">
      <div class="info">
        <div class="poster"></div>
        <div class="lines">
          <div class="line wide"></div>
          <div class="line"></div>
          <div class="line short"></div>
        </div>
      </div>
    </div>
  {/if}
  {#if kind === 'list'}
    {#each [0, 1] as r (r)}
      <div class="panel"><div class="line wide"></div><div class="line"></div><div class="line short"></div></div>
    {/each}
  {:else if kind === 'grid'}
    <div class="grid">
      {#each cards as i (i)}<div class="poster"></div>{/each}
    </div>
  {:else}
    {#each kind === 'title' ? [0] : [0, 1] as r (r)}
      <div class="line heading"></div>
      <div class="row">
        {#each cards as i (i)}<div class="card"><div class="poster"></div></div>{/each}
      </div>
    {/each}
  {/if}
</div>
