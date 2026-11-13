<!-- The page's scrollbar, drawn over the page: the browser's own keeps a
     strip of the window for itself even when it's hidden (app.css hides
     it). Scrolling stays the browser's (wheel, keys, touch); this shows
     where the page is while it scrolls or with the pointer near the right
     edge, and can be dragged. -->
<script lang="ts">
  import { onMount } from 'svelte';

  const near = 28; // pixels from the window's right edge
  const after = 1200; // ms it stays once scrolling stops
  const shortest = 32; // the thumb's least height, in pixels

  let shown = $state(false);
  let dragging = $state(false);
  let top = $state(0);
  let height = $state(0);
  let timer = 0;

  // measure places the thumb: its height, the share of the page in view;
  // its top, how far down the page is. None when nothing scrolls.
  function measure() {
    const view = window.innerHeight;
    const total = document.documentElement.scrollHeight;
    if (total <= view + 1) {
      height = 0;
      return;
    }
    height = Math.max(shortest, (view * view) / total);
    top = ((view - height) * window.scrollY) / (total - view);
  }

  function show() {
    measure();
    shown = true;
    clearTimeout(timer);
    timer = window.setTimeout(() => (shown = false), after);
  }

  onMount(() => {
    const nearEdge = (event: MouseEvent) => {
      if (window.innerWidth - event.clientX < near) show();
    };
    window.addEventListener('scroll', show, { passive: true });
    window.addEventListener('mousemove', nearEdge, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    // The page grows as it loads and changes: the thumb follows.
    const resized = new ResizeObserver(measure);
    resized.observe(document.body);
    measure();
    return () => {
      window.removeEventListener('scroll', show);
      window.removeEventListener('mousemove', nearEdge);
      window.removeEventListener('resize', measure);
      resized.disconnect();
      clearTimeout(timer);
    };
  });

  // grab drags the thumb: the page follows the pointer, at the thumb's scale.
  function grab(event: PointerEvent) {
    event.preventDefault();
    const thumb = event.currentTarget as HTMLElement;
    thumb.setPointerCapture(event.pointerId);
    dragging = true;
    const fromY = event.clientY;
    const fromScroll = window.scrollY;
    const view = window.innerHeight;
    const scale = (document.documentElement.scrollHeight - view) / (view - height);
    const move = (m: PointerEvent) => window.scrollTo(0, fromScroll + (m.clientY - fromY) * scale);
    const done = () => {
      dragging = false;
      thumb.removeEventListener('pointermove', move);
      show();
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', done, { once: true });
    thumb.addEventListener('pointercancel', done, { once: true });
  }
</script>

{#if height}
  <div
    class="thumb"
    class:shown={shown || dragging}
    class:dragging
    style:top="{top}px"
    style:height="{height}px"
    onpointerdown={grab}
    aria-hidden="true"
  ></div>
{/if}

<style>
  /* A 12-pixel grip, drawn as a 4-pixel bar: as the browser's was. */
  .thumb {
    position: fixed;
    right: 0;
    width: 12px;
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    touch-action: none;
    transition: opacity 0.2s;
  }
  .thumb::before {
    content: '';
    position: absolute;
    inset: 0 4px;
    border-radius: 999px;
    background: rgba(var(--text-rgb), 0.16);
  }
  .thumb.shown {
    opacity: 1;
    pointer-events: auto;
  }
  .thumb:hover::before,
  .thumb.dragging::before {
    background: rgba(var(--text-rgb), 0.3);
  }
</style>
