<!-- A person, from TMDB: who they are, then their films and series, those
     a library has first. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { sizes, srcset } from '../lib/images';
  import { loaded } from '../lib/loaded';
  import { has, t } from '../lib/i18n.svelte';
  import { correct, personIdOf, personPath } from '../lib/paths';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id }: { id: string } = $props();
  let wholeBio = $state(false);
  // Titles no library has: folded until asked for.
  let showElsewhere = $state(false);

  const day = (d: string) => new Date(d).toLocaleDateString(undefined, { dateStyle: 'long' });

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
    <h2>{t('titles.inLibrary')}</h2>
    <div class="grid">
      {#each here as c (c.title.id)}
        <Card item={c.title} note={c.roles?.join(', ')} />
      {/each}
    </div>
  {/if}
  {#if elsewhere.length}
    <div class="section-head">
      <h2>{t('titles.notInLibrary')}</h2>
      <button class="link" type="button" aria-expanded={showElsewhere} onclick={() => (showElsewhere = !showElsewhere)}>
        {showElsewhere ? t('person.hideElsewhere') : t('person.showElsewhere', { count: elsewhere.length })}
      </button>
    </div>
    {#if showElsewhere}
      <div class="grid">
        {#each elsewhere as c (c.title.id)}
          <Card item={c.title} note={c.roles?.join(', ')} flags={false} />
        {/each}
      </div>
    {/if}
  {/if}
  {#if !person.credits.length}<p class="muted">{t('person.nothing')}</p>{/if}
{:catch error}
  <PageError {error} />
{/await}
