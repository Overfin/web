<!-- The page's backdrop (lib/backdrop): fixed behind everything, darkened
     toward the text, cross-fading from one picture to the next; the
     poster, when there's one, on a screen taller than wide. Dark on every
     page, as what's drawn over it (app.css). The page says it has one, for
     the header and the sheet its content sits on. -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { pageBackdrop } from '../lib/backdrop.svelte';

  const portrait = typeof matchMedia === 'function' ? matchMedia('(max-aspect-ratio: 1/1)') : null;
  let tall = $state(portrait?.matches ?? false);
  $effect(() => {
    const changed = () => (tall = portrait?.matches ?? false);
    portrait?.addEventListener('change', changed);
    return () => portrait?.removeEventListener('change', changed);
  });

  const url = $derived.by(() => {
    const b = pageBackdrop.current;
    if (!b) return null;
    return (tall ? b.tall || b.wide : b.wide || b.tall) ?? null;
  });

  $effect(() => {
    document.documentElement.classList.toggle('has-backdrop', !!url);
  });
</script>

{#if url}
  <div class="page-backdrop" data-theme="dark" class:tall={url === pageBackdrop.current?.tall} aria-hidden="true">
    {#key url}
      <img src={url} alt="" transition:fade={{ duration: 600 }} />
    {/key}
  </div>
{/if}
