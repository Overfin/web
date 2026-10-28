<!-- The page's backdrop (lib/backdrop): fixed behind everything, darkened
     toward the text, cross-fading from one picture to the next. The page
     says it has one, for the header and the sheet its content sits on. -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { pageBackdrop } from '../lib/backdrop.svelte';

  $effect(() => {
    document.documentElement.classList.toggle('has-backdrop', !!pageBackdrop.url);
  });
</script>

{#if pageBackdrop.url}
  <div class="page-backdrop" aria-hidden="true">
    {#key pageBackdrop.url}
      <img src={pageBackdrop.url} alt="" transition:fade={{ duration: 600 }} />
    {/key}
  </div>
{/if}
