<!-- What a screen shows when loading it failed: the profile picker when no
     profile is chosen yet, "not found" for what doesn't exist (or this
     profile may not see), or the error in words. -->
<script lang="ts">
  import { explain, isError, OverfinError } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { replace } from '../lib/router.svelte';

  let { error = undefined, notFound = false }: { error?: unknown; notFound?: boolean } = $props();

  const missing = $derived(notFound || (error instanceof OverfinError && error.status === 404));
  $effect(() => {
    if (isError(error, 'profile-required')) replace('/profiles');
  });
</script>

<div class="center">
  {#if missing}
    <h1>{t('common.notFound')}</h1>
  {:else if !isError(error, 'profile-required')}
    <p class="error">{explain(error)}</p>
  {/if}
  <a class="button" href="/">{t('common.backHome')}</a>
</div>
