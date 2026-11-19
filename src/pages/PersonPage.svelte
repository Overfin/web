<!-- A person, from TMDB: who they are, then their films and series, those
     a library has first. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { sizes, srcset } from '../lib/images';
  import { loaded } from '../lib/loaded';
  import { date, has, t } from '../lib/i18n.svelte';
  import { correct, personIdOf, personPath } from '../lib/paths';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id }: { id: string } = $props();
  let wholeBio = $state(false);
  // Titles no library has: folded until asked for.
  let showElsewhere = $state(false);

  const day = (d: string) => date(d, 'long');

  // svelte-ignore state_referenced_locally
  const person = overfin.person(id);
  // Its address put right, with the person's name (lib/paths).
  // svelte-ignore state_referenced_locally
  person.then((p) => correct(personPath(id, p.name), (parts) => personIdOf(parts[0]) === id), () => {});
</script>

{#await person}
  <Skeleton kind="title" />
{:then person}
  {@const here = person.credits.filter((c) => c.title.availability !== 'missing')}
  {@const elsewhere = person.credits.filter((c) => c.title.availability === 'missing')}
  <div class="hero">
    <div class="info">
      <div class="poster">
        {#if person.image}<img src={overfin.imageUrl(person.image, 'medium')} srcset={srcset(person.image, 'profile')} sizes={sizes.heroPoster} alt="" use:loaded />{/if}
      </div>
      <div>
        <h1>{person.name}</h1>
        <div class="meta">
          {#if person.department}
            {@const key = `person.department.${person.department}`}
            <span>{has(key) ? t(key) : person.department}</span>
          {/if}
          {#if person.birthday}<span>{t('person.born', { date: day(person.birthday) })}{#if person.birthplace}, {person.birthplace}{/if}</span>{/if}
          {#if person.deathday}<span>{t('person.died', { date: day(person.deathday) })}</span>{/if}
        </div>
        {#if person.biography}
          <p class="overview bio" class:whole={wholeBio}>{person.biography}</p>
          {#if person.biography.length > 400}
            <button class="link" type="button" onclick={() => (wholeBio = !wholeBio)}>{wholeBio ? t('item.castLess') : t('person.more')}</button>
          {/if}
        {/if}
      </div>
    </div>
  </div>
  {#if here.length}
    <h2>{t('titles.inLibrary')} ({here.length})</h2>
    <div class="grid">
      {#each here as c (c.title.id)}
        <Card item={c.title} note={c.roles?.join(', ')} />
      {/each}
    </div>
  {/if}
  {#if elsewhere.length}
    <!-- The heading itself opens and folds them; its triangle says which. -->
    <h2>
      <button class="fold" type="button" aria-expanded={showElsewhere} aria-controls="elsewhere" onclick={() => (showElsewhere = !showElsewhere)}>
        {t('titles.notInLibrary')} ({elsewhere.length}) <span aria-hidden="true">{showElsewhere ? '▴' : '▾'}</span>
      </button>
    </h2>
    <div class="grid" id="elsewhere" hidden={!showElsewhere}>
      {#if showElsewhere}
        {#each elsewhere as c (c.title.id)}
          <Card item={c.title} note={c.roles?.join(', ')} flags={false} />
        {/each}
      {/if}
    </div>
  {/if}
  {#if !person.credits.length}<p class="muted">{t('person.nothing')}</p>{/if}
{:catch error}
  <PageError {error} />
{/await}

<style>
  /* A heading's look, as a button. */
  .fold { font: inherit; color: inherit; background: none; border: none; box-shadow: none; padding: 0; min-height: 0; text-align: start; cursor: pointer; }
  .fold:hover, .fold:active { background: none; transform: none; }
  .fold:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
</style>
