<!-- A titled row of titles, shown only when there's something in it. With
     remove, titles can be taken out (those removable says, or all); with
     help, a "?" beside the title says what the row is; with href, a link
     to the whole of it ("See all", count titles when given). -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { HelpTip } from '@overfin/ui';
  import Card from './Card.svelte';
  import RowHead from './RowHead.svelte';
  import ScrollRow from './ScrollRow.svelte';

  let { title, items, wide = false, remove, removable, removeLabel, help = '', href, count }: {
    title: string; items: TitleSummary[]; wide?: boolean; remove?: (item: TitleSummary) => void;
    /** removeLabel names the remove button (Continue Watching's otherwise). */
    removeLabel?: string;
    removable?: (item: TitleSummary) => boolean;
    /** help: what the row is, behind a "?" beside its title. */
    help?: string;
    /** href: the page with the whole row, count: how many it has. */
    href?: string;
    count?: number;
  } = $props();
</script>

{#if items.length}
  <RowHead {href} {count}>{title}{#if help}<HelpTip text={help} />{/if}</RowHead>
  <ScrollRow>
    {#each items as item (item.id)}
      <Card {item} {wide} {removeLabel} remove={remove && (!removable || removable(item)) ? () => remove(item) : undefined} />
    {/each}
  </ScrollRow>
{/if}
