<!-- What a profile may see besides its age: the operator's categories it
     gets, the libraries it gets, and the tags hidden from it. -->
<script lang="ts">
  import type { Category, Library } from '../lib/sdk/overfin.js';
  import { t } from '../lib/i18n.svelte';

  let {
    libraries, tags, all = $bindable(), chosen = $bindable(), hidden = $bindable(),
    categories = [], allCategories = $bindable(true), chosenCategories = $bindable([]),
  }: {
    libraries: Library[]; tags: string[]; all: boolean; chosen: string[]; hidden: string[];
    categories?: Category[]; allCategories?: boolean; chosenCategories?: string[];
  } = $props();

  function toggle(list: string[], value: string, on: boolean): string[] {
    return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
  }
</script>

<fieldset class="access">
  {#if categories.length}
    <label><input type="checkbox" bind:checked={allCategories} /> {t('access.allCategories')}</label>
    {#if !allCategories}
      {#each categories as c (c.id)}
        <label class="sub">
          <input type="checkbox" checked={chosenCategories.includes(c.id)}
            onchange={(e) => (chosenCategories = toggle(chosenCategories, c.id, e.currentTarget.checked))} />
          {c.name}
        </label>
      {/each}
    {/if}
  {/if}
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
