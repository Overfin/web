<!-- What the account likes, for what the server keeps and gets: series,
     films or both, genres. Asked once (first: with a way to
     skip, which still counts as asked), and changeable on the account page.
     Nobody else sees the answers. -->
<script lang="ts">
  import type { TastesPage } from '../lib/sdk/overfin';
  import { explain, overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';

  let { first = false, done }: { first?: boolean; done: (saved: boolean) => void } = $props();

  let page = $state<TastesPage | null>(null);
  let prefer = $state<'' | 'series' | 'movies' | 'both'>('');
  let genres = $state<number[]>([]);
  let message = $state('');
  let busy = $state(false);

  overfin.tastes().then((p) => {
    page = p;
    prefer = p.prefer ?? '';
    genres = [...p.genres];
  }, (err) => (message = explain(err)));

  function toggle(id: number) {
    genres = genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id];
  }

  async function save(nothing: boolean) {
    message = '';
    busy = true;
    try {
      await overfin.setTastes(nothing ? {} : { prefer: prefer || undefined, genres });
      done(!nothing);
    } catch (err) {
      message = explain(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="tastes">
  {#if first}
    <h1>{t('tastes.title')}</h1>
    <p class="muted">{t('tastes.intro')}</p>
  {/if}
  {#if page}
    <fieldset>
      <legend>{t('tastes.prefer')}</legend>
      <div class="choices">
        {#each [['series', t('tastes.series')], ['movies', t('tastes.movies')], ['both', t('tastes.both')]] as [value, label] (value)}
          <label class="choice"><input type="radio" name="prefer" {value} bind:group={prefer} /> {label}</label>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>{t('tastes.genres')}</legend>
      {#if page.choices.length}
        <div class="genres">
          {#each page.choices as g (g.id)}
            <button type="button" class="genre" aria-pressed={genres.includes(g.id)} onclick={() => toggle(g.id)}>{g.name}</button>
          {/each}
        </div>
      {:else}
        <p class="muted">{t('tastes.noGenres')}</p>
      {/if}
    </fieldset>
    <div class="actions">
      <button class="primary" disabled={busy} onclick={() => save(false)}>{t('tastes.save')}</button>
      {#if first}<button disabled={busy} onclick={() => save(true)}>{t('tastes.skip')}</button>{/if}
    </div>
  {/if}
  {#if message}<p class="error">{message}</p>{/if}
</div>

<style>
  .tastes { display: grid; gap: 1.1rem; }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: .55rem; }
  legend { font-weight: 600; margin-bottom: .45rem; padding: 0; }
  .choices { display: flex; flex-wrap: wrap; gap: .5rem 1.4rem; }
  .choice { display: inline-flex; align-items: center; gap: .45rem; min-height: 2.5rem; cursor: pointer; }
  /* Radios and checkboxes, not text fields. */
  .choice input {
    min-height: 0; width: 1.05rem; height: 1.05rem; margin: 0; padding: 0;
    border: 0; box-shadow: none; background: none; accent-color: var(--accent);
  }
  .genres { display: flex; flex-wrap: wrap; gap: .45rem; }
  .genre {
    border-radius: 999px; padding: .35em .9em; font-size: .9rem;
    background: rgba(var(--text-rgb), .05); border: 1px solid var(--hairline); color: var(--text);
  }
  .genre[aria-pressed='true'], .genre[aria-pressed='true']:hover {
    background: linear-gradient(180deg, #8ec0ff, var(--accent)); border-color: transparent; color: var(--on-accent); font-weight: 600;
  }
  .actions { display: flex; flex-wrap: wrap; gap: .6rem; }
</style>
