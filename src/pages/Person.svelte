<!-- A person: who they are, and what of theirs this profile can watch. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { t } from '../lib/i18n.svelte';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id }: { id: string } = $props();

  async function load() {
    const [person, work] = await Promise.all([
      overfin.person(id),
      overfin.items({ person: id, kind: ['movie', 'series'], sort: 'premiereDate', order: 'desc', limit: 100 }),
    ]);
    return { person, work: work.items };
  }
</script>

{#await load()}
  <Skeleton kind="title" />
{:then { person, work }}
  {@const life = person.birthDate && person.birthDate.slice(0, 4) + (person.deathDate ? ` – ${person.deathDate.slice(0, 4)}` : '')}
  <div class="hero">
    <div class="info">
      <div class="poster">
        {#if person.image}<img src={overfin.imageUrl(person.image, 'medium')} alt="" use:loaded />{/if}
      </div>
      <div>
        <h1>{person.name}</h1>
        {#if life}<div class="meta">{life}</div>{/if}
        {#if person.overview}<p>{person.overview}</p>{/if}
      </div>
    </div>
  </div>
  <h2>{t('person.inLibrary')}</h2>
  {#if work.length}
    <div class="grid">
      {#each work as item (item.id)}
        <Card {item} />
      {/each}
    </div>
  {:else}
    <p class="muted">{t('person.nothing')}</p>
  {/if}
{:catch error}
  <PageError {error} />
{/await}
