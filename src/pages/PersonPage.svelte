<!-- A person, from TMDB: who they are, then their films and series, those
     a library has first. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { has, t } from '../lib/i18n.svelte';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import TMDBNotice from '../components/TMDBNotice.svelte';

  let { id }: { id: string } = $props();
  let wholeBio = $state(false);

  const day = (d: string) => new Date(d).toLocaleDateString(undefined, { dateStyle: 'long' });
</script>

{#await overfin.person(id)}
  <Skeleton kind="title" />
{:then person}
  {@const here = person.credits.filter((c) => c.title.availability !== 'missing')}
  {@const elsewhere = person.credits.filter((c) => c.title.availability === 'missing')}
  <div class="hero">
    <div class="info">
      <div class="poster">
        {#if person.image}<img src={overfin.imageUrl(person.image, 'medium')} alt="" use:loaded />{/if}
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
    <h2>{t('person.inLibrary')}</h2>
    <div class="grid">
      {#each here as c (c.title.id)}
        <Card item={c.title} note={c.roles?.join(', ')} />
      {/each}
    </div>
  {/if}
  {#if elsewhere.length}
    <h2>{t('person.elsewhere')}</h2>
    <div class="grid">
      {#each elsewhere as c (c.title.id)}
        <Card item={c.title} note={c.roles?.join(', ')} flags={false} />
      {/each}
    </div>
  {/if}
  {#if !person.credits.length}<p class="muted">{t('person.nothing')}</p>{/if}
  <TMDBNotice />
{:catch error}
  <PageError {error} />
{/await}
