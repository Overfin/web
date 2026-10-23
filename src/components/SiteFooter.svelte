<!-- The bottom of every page but the player: "Powered by Overfin" with the
     operator's own brand, then TMDB's attribution, last. -->
<script lang="ts">
  import { brand } from '../lib/brand.svelte';
  import PoweredBy from './PoweredBy.svelte';
  import TMDBNotice from './TMDBNotice.svelte';
</script>

<footer class="site-foot">
  {#if brand.custom}<PoweredBy />{/if}
  <TMDBNotice />
</footer>
