<!-- One of Discover's rows, loaded on its own (unless its titles are
     given): it shows as soon as it's there, without waiting for the
     others, and only if it has titles; with href, a link to the whole
     list. -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { discoverRow } from '../lib/warm';
  import Card from './Card.svelte';
  import RowHead from './RowHead.svelte';
  import ScrollRow from './ScrollRow.svelte';

  let { title, list, kind, availability, found = () => {}, flags = true, items: given, href }: {
    title: string;
    list: 'trending' | 'popular' | 'upcoming';
    kind: 'movie' | 'series';
    availability: 'all' | 'library' | 'missing';
    found?: (any: boolean) => void;
    flags?: boolean;
    items?: TitleSummary[];
    href?: string;
  } = $props();

  async function load(): Promise<TitleSummary[]> {
    try {
      const { items } = given ? { items: given } : await discoverRow(list, kind, availability);
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
    <RowHead {href}>{title}</RowHead>
    <ScrollRow>
      {#each items as t (t.id)}
        <Card item={t} {flags} />
      {/each}
    </ScrollRow>
  {/if}
{:catch}
  <!-- A row that can't load is left out; the others still show. -->
{/await}
