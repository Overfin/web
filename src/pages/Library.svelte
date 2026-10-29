<!-- A library, or one of the operator's categories: its titles, sorted
     and filtered (genre, decade, what the profile watched) as the person
     chooses, loaded page by page as they scroll. Choices live in the
     address, a shuffle's seed too, so a reload shows the same page. -->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Genre, TitleQuery, TitlePage, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { keepList, keptList } from '../lib/pagecache';
  import { t, tn, type Key } from '../lib/i18n.svelte';
  import { lastSort, rememberLibrary, rememberSort } from '../lib/lastlibrary';
  import { listKey as keyOf, listQuery, listSort, listSorts, type ListKept } from '../lib/lists';
  import { go } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { categoryIdOf, categoryPath, correct } from '../lib/paths';
  import { visible } from '../lib/visible';
  import { landed } from '../lib/warm';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id, params, category = false }: { id: string; params: URLSearchParams; category?: boolean } = $props();

  // What the profile did with the titles, as a filter.
  const shows = ['all', 'unwatched', 'watched', 'inProgress', 'favorites'] as const;
  type Show = (typeof shows)[number];
  const thisDecade = Math.floor(new Date().getFullYear() / 10) * 10;
  const decades = Array.from({ length: 8 }, (_, i) => thisDecade - 10 * i);

  // What's listed: a library, or a category (films and series alike).
  const library = $derived(category ? session.categories.find((c) => c.id === id) : session.libraries.find((l) => l.id === id));
  const siblings = $derived(category ? session.categories : session.libraries);
  // A category's address is its name (lib/paths); a library's, its ID.
  const base = $derived.by(() => {
    const c = category ? session.categories.find((x) => x.id === id) : undefined;
    return c ? categoryPath(c, session.categories) : `/${category ? 'category' : 'library'}/${id}`;
  });
  // Opened by its ID (an old address): its name instead.
  $effect(() => {
    if (category) correct(base, (parts) => categoryIdOf(parts[0], session.categories) === id);
  });
  // svelte-ignore state_referenced_locally
  if (!category) rememberLibrary(id);
  // The page is shown anew for another library or sort (App keys it on the
  // address).
  // Without one in the address, the sort the profile last chose.
  const profile = $derived(session.me?.activeProfile?.id);
  const sort = $derived.by(() => {
    const value = params.get('sort') || lastSort(profile) || 'name';
    return listSort(value);
  });
  const seed = $derived(params.get('seed') || undefined);
  const genre = $derived(params.get('genre') || '');
  const show = $derived<Show>(shows.includes(params.get('show') as Show) ? (params.get('show') as Show) : 'all');
  // A decade, or "older" (before the last one listed).
  const decade = $derived(params.get('decade') || '');
  const filtered = $derived(!!genre || show !== 'all' || !!decade);

  let genres = $state<Genre[]>([]);
  $effect(() => {
    (category ? overfin.genres(undefined, id) : overfin.genres(id)).then((all) => (genres = all), () => {});
  });

  /** change goes to this library with one choice changed (a new shuffle). */
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete('seed');
    if (name === 'sort') rememberSort(profile, value);
    if (value && value !== 'all' && !(name === 'sort' && value === 'name')) next.set(name, value);
    else next.delete(name);
    const q = next.toString();
    go(`${base}${q ? '?' + q : ''}`);
  }

  // What was read of this list in this tab, as far as it was scrolled,
  // shows at once when it's opened again (pagecache).
  // svelte-ignore state_referenced_locally
  let shuffle = $state(seed ?? '');
  const listKey = $derived(keyOf(profile, base, params, sort, shuffle));
  // svelte-ignore state_referenced_locally
  const kept = keptList<ListKept>(listKey);
  let items = $state<TitleSummary[]>(kept?.items ?? []);
  let total = $state<number | undefined>(kept?.total);
  let finished = $state(kept?.finished ?? false);
  let error = $state<unknown>();
  let sentinel = $state<HTMLElement>();
  let loading = false;
  let pages: AsyncGenerator<TitlePage> | undefined = kept?.pages;
  function keepIt() {
    keepList(listKey, { items: $state.snapshot(items), total, finished, pages });
  }

  function query(): TitleQuery {
    return listQuery(id, category, library && 'kind' in library ? library.kind : undefined, {
      sort, seed, genre, show,
      ...(decade === 'older' ? { yearTo: decades[decades.length - 1] - 1 }
        : decade ? { yearFrom: +decade, yearTo: +decade + 9 } : {}),
    });
  }

  async function more() {
    if (loading || finished || !library) return;
    pages ??= overfin.pages(query());
    loading = true;
    try {
      const { value: page, done } = await pages.next();
      if (done) {
        finished = true;
        keepIt();
        return;
      }
      items.push(...page.items);
      if (page.totalCount !== undefined) total = page.totalCount;
      if (page.seed && !seed) {
        const next = new URLSearchParams(params);
        next.set('seed', page.seed);
        shuffle = page.seed;
        history.replaceState(history.state, '', `${base}?${next}`);
      }
      if (!page.nextCursor) finished = true;
      keepIt();
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
  // The first page as the page opens: the end of the list may be out of
  // reach under a tall placeholder (two columns on a phone).
  // svelte-ignore state_referenced_locally
  if (!items.length && !finished) more().then(landed);
  else landed();
</script>

{#if !library}
  <PageError notFound />
{:else}
  <!-- With several libraries, their names on top: this one marked. A
       category's are in the menu already. -->
  {#if !category && siblings.length > 1}
    <nav class="pills" aria-label={t('nav.libraries')}>
      {#each siblings as l (l.id)}
        <a href="/library/{l.id}" class:active={l.id === id} aria-current={l.id === id ? 'page' : undefined}>{l.name}</a>
      {/each}
    </nav>
    <h1 class="sr-only">{library.name}</h1>
  {:else}
    <h1>{library.name}</h1>
  {/if}
  <div class="toolbar">
    <select aria-label={t('library.sort')} value={sort} onchange={(event) => change('sort', event.currentTarget.value)}>
      {#each listSorts as value (value)}
        <option {value}>{t(`library.sort.${value}` as Key)}</option>
      {/each}
    </select>
    {#if genres.length}
      <select aria-label={t('library.genre')} value={genre} onchange={(event) => change('genre', event.currentTarget.value)}>
        <option value="">{t('library.genre.all')}</option>
        {#each genres as g (g.name)}
          <option value={g.name}>{g.name}</option>
        {/each}
      </select>
    {/if}
    <select aria-label={t('library.decade')} value={decade} onchange={(event) => change('decade', event.currentTarget.value)}>
      <option value="">{t('library.decade.all')}</option>
      {#each decades as d (d)}
        <option value={String(d)}>{t('library.decade.one', { decade: d })}</option>
      {/each}
      <option value="older">{t('library.decade.older', { year: decades[decades.length - 1] })}</option>
    </select>
    <select aria-label={t('library.show')} value={show} onchange={(event) => change('show', event.currentTarget.value)}>
      {#each shows as value (value)}
        <option {value}>{t(`library.show.${value}` as Key)}</option>
      {/each}
    </select>
    {#if filtered}
      <button class="link" type="button" onclick={() => go(sort === 'name' ? base : `${base}?sort=${sort}`)}>{t('library.clear')}</button>
    {/if}
    {#if total !== undefined}
      <span class="muted count">{tn('library.count', total)}</span>
    {/if}
  </div>
  <div class="grid">
    {#each items as item (item.id)}
      <Card {item} />
    {/each}
  </div>
  {#if !items.length && !finished}
    <Skeleton kind="grid" />
  {/if}
  {#if finished && !items.length && !error}
    <p class="muted">{filtered ? t('library.noMatch') : t('common.nothingYet')}</p>
  {/if}
  {#if error}
    <PageError {error} />
  {:else if !finished}
    <div bind:this={sentinel} use:visible={more}></div>
  {/if}
{/if}
