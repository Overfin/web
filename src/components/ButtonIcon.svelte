<!-- The icon at the start of a text button: play, request, wish (a
     star with a plus; wished: filled), from the start again, more
     information. In the text's color. -->
<script lang="ts">
  let { name }: { name: 'play' | 'request' | 'wish' | 'wished' | 'restart' | 'info' } = $props();
</script>

<svg class="icon {name}" viewBox="0 0 24 24" aria-hidden="true">
  {#if name === 'play'}
    <path d="M8 5v14l11-7z" />
  {:else if name === 'request'}
    <path d="M11 4h2v8.2l3.1-3.1 1.4 1.4L12 16l-5.5-5.5 1.4-1.4L11 12.2zM5 18h14v2H5z" />
  {:else if name === 'wish'}
    <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8zm0 4.3l-1.6 3.4-3.7.5 2.7 2.6-.7 3.7 3.3-1.8 3.3 1.8-.7-3.7 2.7-2.6-3.7-.5z" fill-rule="evenodd" />
  {:else if name === 'wished'}
    <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z" />
  {:else if name === 'restart'}
    <path d="M12 5V2L7.5 6 12 10V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
  {:else}
    <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 14h-2v-6h2zm0-8h-2V7h2z" />
  {/if}
</svg>
