<!-- One of Discover's rows, loaded on its own (unless its titles are
     given): it shows as soon as it's there, without waiting for the
     others, and only if it has titles. -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import Card from './Card.svelte';
  import ScrollRow from './ScrollRow.svelte';

  let { title, list, kind, availability, found = () => {}, flags = true, items: given }: {
    title: string;
    list: 'trending' | 'popular' | 'upcoming';
    kind: 'movie' | 'series';
    availability: 'all' | 'library' | 'missing';
    found?: (any: boolean) => void;
    flags?: boolean;
    items?: TitleSummary[];
  } = $props();

  async function load(): Promise<TitleSummary[]> {
    try {
      const { items } = given ? { items: given } : await overfin.discover(list, kind, { availability, limit: 20 });
      found(items.length > 0);
      return items;
    } catch (err) {
      found(false); // answered, with nothing: the page doesn't wait for it
      throw err;
    }
  }
</script>

{#await load() then items}
  {#if items.length}
    <h2>{title}</h2>
    <ScrollRow>
      {#each items as t (t.id)}
        <Card item={t} {flags} />
      {/each}
    </ScrollRow>
  {/if}
{:catch}
  <!-- A row that can't load is left out; the others still show. -->
{/await}
