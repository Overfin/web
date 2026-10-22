<!-- A library: its titles, sorted as the person chooses, loaded page by
     page as they scroll. A shuffle keeps its seed in the address, so a
     reload shows the same order. -->
<script lang="ts">
  import { tick } from 'svelte';
  import type { ItemPage, ItemQuery, ItemSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { t, tn, type Key } from '../lib/i18n.svelte';
  import { go } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { visible } from '../lib/visible';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';

  let { id, params }: { id: string; params: URLSearchParams } = $props();

  const sorts = ['name', 'addedAt', 'premiereDate', 'communityRating', 'lastPlayed', 'random'] as const;
  // Which titles a library lists, by its kind.
  const kinds: Record<string, string> = { movies: 'movie', shows: 'series', musicVideos: 'musicVideo', music: 'musicAlbum', books: 'book' };

  const library = $derived(session.libraries.find((l) => l.id === id));
  // The page is shown anew for another library or sort (App keys it on the
  // address).
  const sort = $derived((params.get('sort') || 'name') as NonNullable<ItemQuery['sort']>);
  const seed = $derived(params.get('seed') || undefined);

  let items = $state<ItemSummary[]>([]);
  let total = $state<number>();
  let finished = $state(false);
  let error = $state<unknown>();
  let sentinel = $state<HTMLElement>();
  let loading = false;
  let pages: AsyncGenerator<ItemPage> | undefined;

  function query(): ItemQuery {
    return {
      library: id,
      sort,
      limit: 60,
      kind: library ? kinds[library.kind] : undefined,
      order: ['addedAt', 'premiereDate', 'communityRating', 'lastPlayed'].includes(sort) ? 'desc' : undefined,
      seed: sort === 'random' ? seed : undefined,
    };
  }

  async function more() {
    if (loading || finished || !library) return;
    pages ??= overfin.pages(query());
    loading = true;
    try {
      const { value: page, done } = await pages.next();
      if (done) {
        finished = true;
        return;
      }
      items.push(...page.items);
      if (page.totalCount !== undefined) total = page.totalCount;
      if (page.seed && !seed) history.replaceState(null, '', `/library/${id}?sort=random&seed=${page.seed}`);
      if (!page.nextCursor) finished = true;
    } catch (err) {
      error = err;
      finished = true;
    } finally {
      loading = false;
    }
    // Still room on screen: the next page right away.
    await tick();
    if (!finished && sentinel && sentinel.getBoundingClientRect().top < innerHeight * 2) more();
  }
</script>

{#if !library}
  <PageError notFound />
{:else}
  <h1>{library.name}</h1>
  <div class="toolbar">
    <select aria-label={t('library.sort')} value={sort} onchange={(event) => go(`/library/${id}?sort=${event.currentTarget.value}`)}>
      {#each sorts as value (value)}
        <option {value}>{t(`library.sort.${value}` as Key)}</option>
      {/each}
    </select>
    {#if total !== undefined}
      <span class="muted">{tn('library.count', total)}</span>
    {/if}
  </div>
  <div class="grid">
    {#each items as item (item.id)}
      <Card {item} />
    {/each}
  </div>
  {#if error}
    <PageError {error} />
  {:else if !finished}
    <div bind:this={sentinel} use:visible={more}></div>
  {/if}
{/if}
