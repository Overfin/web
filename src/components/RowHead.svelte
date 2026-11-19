<!-- A row's title, with a link to the whole of it on the right when the
     row has one ("See all", with how many when that's known). -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../lib/i18n.svelte';

  let { href, count, children }: { href?: string; count?: number; children: Snippet } = $props();
</script>

{#if href}
  <div class="row-head">
    <h2>{@render children()}</h2>
    <a {href}>{count === undefined ? t('genres.seeAll') : t('genres.seeAllCount', { count })}</a>
  </div>
{:else}
  <h2>{@render children()}</h2>
{/if}

<style>
  .row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .row-head a { color: var(--muted); white-space: nowrap; }
  .row-head a:hover { color: var(--text); }
</style>
