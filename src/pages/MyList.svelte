<!-- The profile's list: every title it added, newest first, each one with a
     button to take it off. -->
<script lang="ts">
  import type { TitleSummary } from '../lib/sdk/overfin.js';
  import { explain, overfin } from '../lib/client';
  import { notice } from '../lib/dialog.svelte';
  import { homeChanged } from '../lib/homecache';
  import { t } from '../lib/i18n.svelte';
  import Card from '../components/Card.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let items = $state<TitleSummary[] | null>(null);
  let error = $state<unknown>();
  overfin.watchlist().then((all) => (items = all), (err) => (error = err));

  // Gone at once; back where it was if the server refuses.
  async function remove(item: TitleSummary) {
    if (!items) return;
    const at = items.indexOf(item);
    items.splice(at, 1);
    homeChanged();
    try {
      await overfin.removeFromWatchlist(item.id);
    } catch (err) {
      items.splice(at, 0, item);
      await notice(explain(err));
    }
  }
</script>

<h1>{t('list.title')}</h1>
{#if error}
  <PageError {error} />
{:else if !items}
  <Skeleton kind="grid" />
{:else if !items.length}
  <p class="muted">{t('list.empty')}</p>
{:else}
  <div class="grid">
    {#each items as item (item.id)}
      <Card {item} remove={() => remove(item)} removeLabel={t('item.listRemove')} />
    {/each}
  </div>
{/if}
