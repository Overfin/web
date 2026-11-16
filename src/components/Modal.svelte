<!-- A window over the page, for a form: its title, then what it holds.
     Escape, its close button or a click outside it close it (close says
     so). Nothing on the site is edited in place: lists open their forms in
     one of these. -->
<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { t } from '../lib/i18n.svelte';

  let { title, close, wide = false, children }: { title: string; close: () => void; wide?: boolean; children: Snippet } = $props();

  let element = $state<HTMLDialogElement>();
  const id = `modal-${Math.random().toString(36).slice(2)}`;
  // What had the focus when the window opened (its button) gets it back
  // when it goes: a window taken off the page, rather than closed, leaves
  // the focus nowhere (a remote's arrows then start from the top).
  const opener = document.activeElement as HTMLElement | null;
  onDestroy(() => {
    requestAnimationFrame(() => {
      if (opener?.isConnected && (!document.activeElement || document.activeElement === document.body)) opener.focus({ preventScroll: true });
    });
  });
  $effect(() => {
    if (element && !element.open) element.showModal();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="modal" class:wide bind:this={element} aria-labelledby={id}
  oncancel={(e) => { e.preventDefault(); close(); }}
  onclick={(e) => { if (e.target === element) close(); }}>
  <div class="modal-head">
    <h2 {id}>{title}</h2>
    <button type="button" class="link close" aria-label={t('common.close')} title={t('common.close')} onclick={close}>×</button>
  </div>
  {@render children()}
</dialog>
