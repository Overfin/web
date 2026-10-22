<!-- One title from discovery: its poster, its name and year, and whether the
     library has it. In the library, it opens the library's own page;
     otherwise, the title's page. -->
<script lang="ts">
  import type { CatalogTitle } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { t } from '../lib/i18n.svelte';

  let { title, flags = true }: { title: CatalogTitle; flags?: boolean } = $props();

  const href = $derived(title.libraryItem ? `/item/${title.libraryItem.id}` : `/title/${title.mediaKind}/${title.tmdbId}`);
  const flag = $derived(!flags ? '' : title.availability === 'available' ? t('discover.inLibrary')
    : title.availability === 'partiallyAvailable' ? t('discover.partly') : '');
</script>

<a class="card" {href}>
  <div class="poster">
    {#if title.images?.primary}
      <img src={overfin.imageUrl(title.images.primary, 'small')} alt="" loading="lazy" use:loaded />
    {:else}
      <div class="fallback">{title.name}</div>
    {/if}
    {#if flag}<span class="flag">{flag}</span>{/if}
  </div>
  <div class="title">{title.name}</div>
  <div class="sub">{title.year ?? ''}</div>
</a>
