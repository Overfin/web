<!-- Discover: what's trending, popular and upcoming, films and series, that
     the libraries don't have (what they have is on the home page). -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import DiscoverRow from '../components/DiscoverRow.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { discoverRows, landed } from '../lib/warm';


  const rows = discoverRows;

  // How many rows answered, and whether any had titles: "nothing here"
  // only once they all have.
  let answered = $state(0);
  let any = $state(false);
  function found(has: boolean) {
    answered++;
    any ||= has;
    if (answered === rows.length) landed();
  }
</script>

<h1>{t('discover.title')}</h1>

{#if answered < rows.length && !any}
  <Skeleton />
{:else if answered === rows.length && !any}
  <p class="muted">{t('common.nothingYet')}</p>
{/if}
{#each rows as row (row.key)}
  <DiscoverRow title={t(row.key)} list={row.list} kind={row.kind} availability="missing" flags={false} {found} />
{/each}
