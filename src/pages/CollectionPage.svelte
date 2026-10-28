<!-- A collection: its picture and what it is, then every one of its films
     in release order, those the libraries have and the others (to be
     requested, once out), as title pages show them. -->
<script lang="ts">
  import type { Collection } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { backdropOf } from '../lib/backdrop.svelte';
  import { t } from '../lib/i18n.svelte';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id }: { id: string } = $props();

  let collection = $state<Collection | null>(null);
  let error = $state<unknown>();
  // svelte-ignore state_referenced_locally
  overfin.collection(id).then((c) => (collection = c), (err) => (error = err));
</script>

{#if error}
  <PageError {error} />
{:else if !collection}
  <Skeleton kind="title" />
{:else}
  {@const backdrop = collection.images?.backdrops?.[0]}
  <div class="hero" class:art={!!backdrop} use:backdropOf={backdrop ? { wide: overfin.imageUrl(backdrop, 'large'),
    tall: collection.images?.primary ? overfin.imageUrl(collection.images.primary, 'large') : undefined } : undefined}>
    <div class="info">
      {#if collection.images?.primary}
        <div class="poster">
          <img src={overfin.imageUrl(collection.images.primary, 'medium')} alt="" use:loaded />
        </div>
      {/if}
      <div>
        <h1>{collection.name}</h1>
        <div class="meta">
          <span>{t('collections.count', { have: collection.inLibrary, films: collection.films })}</span>
        </div>
        {#if collection.overview}<p>{collection.overview}</p>{/if}
      </div>
    </div>
  </div>
  <div class="sheet">
    <h2>{t('collection.films')}</h2>
    <div class="grid">
      {#each collection.items ?? [] as item (item.id)}
        <Card {item} />
      {/each}
    </div>
  </div>
{/if}
