<!-- Search: titles, those in a library apart from the others, and people,
     as one types; people
     first when the words look like someone's name. The words are in the
     address (/search?q=…), changed as one types without a new history
     entry, so Back from a result, a reload or a link shows the same
     search. This tab keeps them too, for the profile searching: /search
     alone opens with them. The address wins.
     The search icon, from another page, starts a new one, empty. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { explain, overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { personPath } from '../lib/paths';
  import { router } from '../lib/router.svelte';
  import { searchPath, searchWords } from '../lib/searchwords';
  import { t } from '../lib/i18n.svelte';
  import { session } from '../lib/session.svelte';
  import Card from '../components/Card.svelte';

  const saved = 'overfin-web-search';
  let query = $state('');
  let input = $state<HTMLInputElement>();
  let results = $state<Awaited<ReturnType<typeof overfin.search>> | null>(null);
  let searching = $state(false);
  let error = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asked = 0; // only the latest search's answer is shown
  // No search once the page is left.
  $effect(() => () => clearTimeout(timer));

  // The words are kept with the profile they're the search of: another
  // profile on this tab doesn't see them.
  const profile = () => session.me?.activeProfile?.id ?? '';

  async function run(q: string) {
    try {
      sessionStorage.setItem(saved, JSON.stringify({ profile: profile(), q }));
    } catch {
      // private browsing: nothing kept
    }
    // The address follows, in place: one history entry however much one
    // types (the page isn't drawn again for it).
    history.replaceState(history.state, '', searchPath(q));
    if (q.trim().length < 2) {
      asked++; // a search still on its way is no longer wanted
      searching = false;
      results = null;
      return;
    }
    const mine = ++asked;
    searching = true;
    try {
      const found = await overfin.search(q);
      if (mine === asked) {
        results = found;
        error = '';
      }
    } catch (err) {
      if (mine === asked) error = explain(err);
    } finally {
      if (mine === asked) searching = false;
    }
  }

  function typed() {
    clearTimeout(timer);
    timer = setTimeout(() => run(query), 350);
  }

  onMount(() => {
    let kept: unknown = null;
    try {
      kept = JSON.parse(sessionStorage.getItem(saved) ?? 'null');
    } catch {
      // nothing kept
    }
    query = searchWords(router.route.params, kept, profile());
    if (query) run(query);
    input?.focus();
  });
</script>

<div class="search">
  <form role="search" onsubmit={(e) => { e.preventDefault(); clearTimeout(timer); run(query); }}>
    <input bind:this={input} type="search" bind:value={query} oninput={typed} placeholder={t('search.placeholder')}
      aria-label={t('search.label')} autocomplete="off" maxlength="200" />
  </form>

  {#if error}
    <p class="error">{error}</p>
  {:else if results}
    {#if !results.titles.length && !results.people.length}
      <p class="muted">{t('search.nothing')}</p>
    {/if}
    {#if results.peopleFirst}
      {@render people(results.people)}
      {@render titles(results.titles)}
    {:else}
      {@render titles(results.titles)}
      {@render people(results.people)}
    {/if}
  {:else if searching}
    <p class="muted">{t('app.loading')}</p>
  {:else}
    <p class="muted">{t('search.hint')}</p>
  {/if}
</div>

{#snippet titles(found: TitleSummary[])}
  {@const here = found.filter((it) => it.availability !== 'missing')}
  {@const away = found.filter((it) => it.availability === 'missing')}
  {#if here.length}
    <h2>{t('titles.inLibrary')}</h2>
    <div class="grid">
      {#each here as item (item.id)}
        <Card {item} />
      {/each}
    </div>
  {/if}
  {#if away.length}
    <h2>{t('titles.notInLibrary')}</h2>
    <div class="grid">
      {#each away as item (item.id)}
        <Card {item} flags={false} />
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet people(found: Awaited<ReturnType<typeof overfin.search>>['people'])}
  {#if found.length}
    <h2>{t('search.people')}</h2>
    <div class="row">
      {#each found as p (p.id)}
        <a class="card person" href={personPath(p.id, p.name)}>
          <div class="poster round">
            {#if p.image}
              <img src={overfin.imageUrl(p.image, 'small')} alt="" loading="lazy" use:loaded />
            {:else}
              <div class="fallback initials">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            {/if}
          </div>
          <div class="title">{p.name}</div>
        </a>
      {/each}
    </div>
  {/if}
{/snippet}
