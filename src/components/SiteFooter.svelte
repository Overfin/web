<!-- The bottom of every page but the player: "Powered by Overfin" with the
     operator's own brand, then, on the home page only, TMDB's attribution,
     last: its terms ask for it somewhere, not everywhere. -->
<script lang="ts">
  import { brand } from '../lib/brand.svelte';
  import PoweredBy from './PoweredBy.svelte';
  import TMDBNotice from './TMDBNotice.svelte';

  let { tmdb = false }: { tmdb?: boolean } = $props();
</script>

{#if brand.custom || tmdb}
  <footer class="site-foot">
    {#if brand.custom}<PoweredBy />{/if}
    {#if tmdb}<TMDBNotice />{/if}
  </footer>
{/if}
