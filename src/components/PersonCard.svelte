<!-- A person in a row: their photo, name, and role. -->
<script lang="ts">
  import type { Credit } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';

  let { person, sub = '' }: { person: Credit['person']; sub?: string } = $props();
</script>

<a class="card" href="/person/{person.id}">
  <div class="poster">
    {#if person.image}
      <img src={overfin.imageUrl(person.image, 'small')} alt="" loading="lazy" use:loaded />
    {:else}
      <div class="fallback">{person.name}</div>
    {/if}
  </div>
  <div class="title">{person.name}</div>
  <div class="sub">{sub}</div>
</a>
