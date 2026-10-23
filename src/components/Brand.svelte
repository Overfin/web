<!-- The site's brand, in the header: Overfin's banner, or the operator's
     (its light version on light pages, when there's one; the name as text
     without any). -->
<script lang="ts">
  import { brand } from '../lib/brand.svelte';
  import OverfinBanner from './OverfinBanner.svelte';
</script>

<a class="brand" href="/" aria-label={brand.name}>
  {#if !brand.custom}
    <OverfinBanner />
  {:else if brand.banner.dark}
    <img class:dark={!!brand.banner.light} src={brand.banner.dark} alt={brand.name} />
    {#if brand.banner.light}<img class="light" src={brand.banner.light} alt={brand.name} />{/if}
  {:else}
    <span class="name">{brand.name}</span>
  {/if}
</a>
