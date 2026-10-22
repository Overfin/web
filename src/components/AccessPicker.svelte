<!-- What a profile may see besides its ratings: the libraries it gets, and
     the tags hidden from it. -->
<script lang="ts">
  import type { Library } from '../lib/sdk/overfin.js';
  import { t } from '../lib/i18n.svelte';

  let {
    libraries, tags, all = $bindable(), chosen = $bindable(), hidden = $bindable(),
  }: { libraries: Library[]; tags: string[]; all: boolean; chosen: string[]; hidden: string[] } = $props();

  function toggle(list: string[], value: string, on: boolean): string[] {
    return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
  }
</script>

<fieldset class="access">
  <label><input type="checkbox" bind:checked={all} /> {t('access.allLibraries')}</label>
  {#if !all}
    {#each libraries as lib (lib.id)}
      <label class="sub">
        <input type="checkbox" checked={chosen.includes(lib.id)}
          onchange={(e) => (chosen = toggle(chosen, lib.id, e.currentTarget.checked))} />
        {lib.name}
      </label>
    {/each}
  {/if}
  <details>
    <summary>{t('access.hiddenTags')}{hidden.length ? ` (${hidden.length})` : ''}</summary>
    {#each tags as tag (tag)}
      <label class="sub">
        <input type="checkbox" checked={hidden.some((h) => h.toLowerCase() === tag.toLowerCase())}
          onchange={(e) => (hidden = e.currentTarget.checked
            ? [...hidden, tag]
            : hidden.filter((h) => h.toLowerCase() !== tag.toLowerCase()))} />
        {tag}
      </label>
    {:else}
      <p class="muted">{t('access.noTags')}</p>
    {/each}
  </details>
</fieldset>

<style>
  .access { border: none; padding: 0; margin: 0; display: grid; gap: .3rem; }
  .sub { margin-left: 1.5rem; }
  details { margin-top: .3rem; }
  details > :not(summary) { display: block; }
  summary { cursor: pointer; }
</style>
