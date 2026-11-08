<!-- An arrow's chevron, centered in its round button (a ‹ or › of the
     font sits off center). In the text's color. -->
<script lang="ts">
  let { left = false }: { left?: boolean } = $props();
</script>

<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
