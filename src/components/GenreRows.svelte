<!-- A category's titles to browse: recently added, then a row per genre,
     the genres it has most first, each leading to all of that genre. -->
<script lang="ts">
  import type { Genre, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import Card from './Card.svelte';
  import ScrollRow from './ScrollRow.svelte';

  let { category, base, genres }: { category: string; base: string; genres: Genre[] } = $props();

  // How many genres get a row.
  const shown = 8;
  const kind: ('movie' | 'series')[] = ['movie', 'series'];

  let recent = $state<TitleSummary[]>([]);
  let rows = $state<{ genre: string; items: TitleSummary[] }[]>([]);

  $effect(() => {
    overfin.titles({ category, kind, sort: 'addedAt', order: 'desc', limit: 20 }).then((p) => (recent = p.items), () => {});
  });
  $effect(() => {
    const top = [...genres].sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0)).slice(0, shown);
    Promise.all(top.map((g) => overfin.titles({ category, kind, genre: g.name, sort: 'communityRating', order: 'desc', limit: 20 })
      .then((p) => ({ genre: g.name, items: p.items }), () => ({ genre: g.name, items: [] })))).then((all) => (rows = all));
  });
</script>

{#if recent.length}
  <h2>{t('genres.recent')}</h2>
  <ScrollRow>
    {#each recent as item (item.id)}<Card {item} />{/each}
  </ScrollRow>
{/if}
{#each rows as row (row.genre)}
  {#if row.items.length}
    <div class="row-head">
      <h2>{row.genre}</h2>
      <a href="{base}?genre={encodeURIComponent(row.genre)}">{t('genres.seeAll')}</a>
    </div>
    <ScrollRow>
      {#each row.items as item (item.id)}<Card {item} />{/each}
    </ScrollRow>
  {/if}
{/each}

<style>
  .row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .row-head a { color: var(--muted); white-space: nowrap; }
  .row-head a:hover { color: var(--text); }
</style>
