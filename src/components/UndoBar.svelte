<!-- The Undo message (lib/undo): at the bottom of the screen, read out by
     screen readers, its button reachable by the keyboard and a remote. -->
<script lang="ts">
  import { undoNow, undoState } from '../lib/undo.svelte';
  import { t } from '../lib/i18n.svelte';
</script>

<div class="undo" role="status" aria-live="polite">
  {#if undoState.current}
    <span>{undoState.current.message}</span>
    <button type="button" onclick={undoNow}>{t('common.undo')}</button>
  {/if}
</div>

<style>
  .undo { position: fixed; z-index: 60; left: 50%; bottom: 1.5rem; transform: translateX(-50%); display: flex; align-items: center; gap: 1rem;
    width: max-content; max-width: calc(100vw - 2rem); box-sizing: border-box; }
  @media (max-width: 600px) { .undo { width: calc(100vw - 2rem); justify-content: space-between; } }
  .undo:not(:empty) { padding: .6rem .6rem .6rem 1rem; border-radius: 14px; background: rgba(var(--panel-rgb), .95);
    border: 1px solid var(--hairline); box-shadow: 0 6px 24px rgba(0, 0, 0, .35); }
  .undo span { font-size: .9rem; }
  .undo button { min-height: 0; padding: .35em .9em; border-radius: 999px; font-weight: 600; white-space: nowrap; }
</style>
