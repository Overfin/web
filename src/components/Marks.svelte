<!-- A title's marks for the profile: my list, watched, favorite, as icons
     that fill in when on. What the server says back replaces what was
     loaded; a failure is said, and changes nothing. The list's icon shows
     once the server says whether the title is on it (and not at all where
     there's no watchlist). -->
<script lang="ts">
  import { homeChanged } from '../lib/homecache';
  import { explain, overfin } from '../lib/client';
  import { notice } from '../lib/dialog.svelte';
  import { t } from '../lib/i18n.svelte';

  let { id, played: loadedPlayed = false, favorite: loadedFavorite = false }: {
    id: string; played?: boolean; favorite?: boolean;
  } = $props();

  let onList = $state<boolean | null>(null);
  let marks = $state<{ played?: boolean; favorite?: boolean }>({});
  // Another title: what was marked here was the last one's.
  $effect(() => {
    marks = {};
    onList = null;
    overfin.onWatchlist(id).then((on) => (onList = on)).catch(() => {}); // not offered here
  });
  async function toggleList() {
    homeChanged();
    const was = onList;
    onList = !onList;
    try {
      await (onList ? overfin.addToWatchlist(id) : overfin.removeFromWatchlist(id));
    } catch (err) {
      onList = was; // as it still is
      await notice(explain(err));
    }
  }

  const played = $derived(marks.played ?? loadedPlayed);
  const favorite = $derived(marks.favorite ?? loadedFavorite);
  async function togglePlayed() {
    homeChanged();
    try {
      marks.played = (await overfin.setPlayed(id, !played)).played;
    } catch (err) {
      await notice(explain(err));
    }
  }
  async function toggleFavorite() {
    homeChanged();
    const was = favorite;
    try {
      marks.favorite = (await overfin.setFavorite(id, !was)).favorite;
    } catch (err) {
      await notice(explain(err));
    }
  }
</script>

{#if onList !== null}
  {@const label = onList ? t('item.listRemove') : t('item.listAdd')}
  <button class="toggle" class:on={onList} aria-pressed={onList} aria-label={label} title={label} onclick={toggleList}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z" /></svg>
  </button>
{/if}
<button class="toggle" class:on={played} aria-pressed={played} aria-label={played ? t('item.markUnwatched') : t('item.markWatched')}
  title={played ? t('item.markUnwatched') : t('item.markWatched')} onclick={togglePlayed}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path class="mark" d="M7.8 12.3l2.8 2.8 5.6-5.8" /></svg>
</button>
<button class="toggle heart" class:on={favorite} aria-pressed={favorite}
  aria-label={favorite ? t('item.favoriteRemove') : t('item.favoriteAdd')} title={favorite ? t('item.favoriteRemove') : t('item.favoriteAdd')}
  onclick={toggleFavorite}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3l-1.3-1.2C5.9 14.8 3 12.2 3 8.9 3 6.3 5 4.3 7.6 4.3c1.6 0 3.2.8 4.4 2 1.2-1.2 2.8-2 4.4-2 2.6 0 4.6 2 4.6 4.6 0 3.3-2.9 5.9-7.7 10.2z" /></svg>
</button>
