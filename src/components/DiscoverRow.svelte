<!-- One of Discover's rows, loaded on its own: it shows as soon as it's
     there, without waiting for the others, and only if it has titles. -->
<script lang="ts">
  import type { CatalogTitle } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import CatalogCard from './CatalogCard.svelte';

  let { title, list, kind, availability, found = () => {}, flags = true }: {
    title: string;
    list: 'trending' | 'popular' | 'upcoming';
    kind: 'movie' | 'series';
    availability: 'all' | 'library' | 'missing';
    found?: (any: boolean) => void;
    flags?: boolean;
  } = $props();

  async function load(): Promise<CatalogTitle[]> {
    const { items } = await overfin.discover(list, kind, { availability, limit: 20 });
    found(items.length > 0);
    return items;
  }
</script>

{#await load() then items}
  {#if items.length}
    <h2>{title}</h2>
    <div class="row">
      {#each items as t (t.mediaKind + t.tmdbId)}
        <CatalogCard title={t} {flags} />
      {/each}
    </div>
  {/if}
{:catch}
  <!-- A row that can't load is left out; the others still show. -->
{/await}
