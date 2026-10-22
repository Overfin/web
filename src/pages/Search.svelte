<!-- Search: titles, in a library or not, and people, as one types; people
     first when the words look like someone's name. The words never go in
     the address (they'd stay in the history), nor are they kept: the
     search opens empty every time. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { explain, overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { t } from '../lib/i18n.svelte';
  import Card from '../components/Card.svelte';
  import TMDBNotice from '../components/TMDBNotice.svelte';

  let query = $state('');
  let input = $state<HTMLInputElement>();
  let results = $state<Awaited<ReturnType<typeof overfin.search>> | null>(null);
  let searching = $state(false);
  let error = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asked = 0; // only the latest search's answer is shown

  async function run(q: string) {
    if (q.trim().length < 2) {
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
    // Words from an earlier search, kept by an older version: forgotten.
    try {
      sessionStorage.removeItem('overfin-web-search');
    } catch {
      // nothing to forget
    }
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
    <TMDBNotice />
  {:else if searching}
    <p class="muted">{t('app.loading')}</p>
  {:else}
    <p class="muted">{t('search.hint')}</p>
  {/if}
</div>

{#snippet titles(found: TitleSummary[])}
  {#if found.length}
    <h2>{t('search.titles')}</h2>
    <div class="grid">
      {#each found as item (item.id)}
        <Card {item} />
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet people(found: Awaited<ReturnType<typeof overfin.search>>['people'])}
  {#if found.length}
    <h2>{t('search.people')}</h2>
    <div class="row">
      {#each found as p (p.id)}
        <a class="card person" href="/person/{p.id}">
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
