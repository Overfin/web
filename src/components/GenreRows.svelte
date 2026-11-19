<!-- A category's titles to browse: recently added, then a row per genre,
     the genres it has most first, each leading to all of that genre. -->
<script lang="ts">
  import type { Genre, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import Card from './Card.svelte';
  import RowHead from './RowHead.svelte';
  import ScrollRow from './ScrollRow.svelte';

  let { category, base, genres }: { category: string; base: string; genres: Genre[] } = $props();

  // How many genres get a row.
  const shown = 8;
  const kind: ('movie' | 'series')[] = ['movie', 'series'];

  let recent = $state<TitleSummary[]>([]);
  // The category's whole count, as the recent ones' answer gives it.
  let total = $state<number | undefined>();
  let rows = $state<{ genre: string; count?: number; items: TitleSummary[] }[]>([]);

  $effect(() => {
    overfin.titles({ category, kind, sort: 'addedAt', order: 'desc', limit: 20 }).then((p) => {
      recent = p.items;
      total = p.totalCount;
    }, () => {});
  });
  $effect(() => {
    const top = [...genres].sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0)).slice(0, shown);
    Promise.all(top.map((g) => overfin.titles({ category, kind, genre: g.name, sort: 'communityRating', order: 'desc', limit: 20 })
      .then((p) => ({ genre: g.name, count: g.itemCount, items: p.items }), () => ({ genre: g.name, items: [] })))).then((all) => (rows = all));
  });
</script>

{#if recent.length}
  <RowHead href="{base}?sort=addedAt" count={total}>{t('genres.recent')}</RowHead>
  <ScrollRow>
    {#each recent as item (item.id)}<Card {item} />{/each}
  </ScrollRow>
{/if}
{#each rows as row (row.genre)}
  {#if row.items.length}
    <RowHead href="{base}?genre={encodeURIComponent(row.genre)}" count={row.count}>{row.genre}</RowHead>
    <ScrollRow>
      {#each row.items as item (item.id)}<Card {item} />{/each}
    </ScrollRow>
  {/if}
{/each}

