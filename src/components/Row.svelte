<!-- A titled row of titles, shown only when there's something in it. With
     remove, titles can be taken out (those removable says, or all). -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import Card from './Card.svelte';

  let { title, items, wide = false, remove, removable }: {
    title: string; items: TitleSummary[]; wide?: boolean; remove?: (item: TitleSummary) => void;
    removable?: (item: TitleSummary) => boolean;
  } = $props();
</script>

{#if items.length}
  <h2>{title}</h2>
  <div class="row">
    {#each items as item (item.id)}
      <Card {item} {wide} remove={remove && (!removable || removable(item)) ? () => remove(item) : undefined} />
    {/each}
  </div>
{/if}
