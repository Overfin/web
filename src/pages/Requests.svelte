<!-- The profile's requests (the owner's: its kids profiles' too), the latest
     first: each title, the seasons asked for, where the request is, and
     cancelling one while it's pending. -->
<script lang="ts">
  import type { MediaRequest } from '../lib/sdk/overfin.js';
  import { explain, overfin } from '../lib/client';
  import { confirm, notice } from '../lib/dialog.svelte';
  import { homeChanged } from '../lib/homecache';
  import { t, type Key } from '../lib/i18n.svelte';
  import { loaded } from '../lib/loaded';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let cancelled = $state<string[]>([]);
  async function cancel(r: MediaRequest) {
    if (!(await confirm(t('request.cancelConfirm')))) return;
    try {
      await overfin.cancelRequest(r.id);
      homeChanged();
      cancelled = [...cancelled, r.id];
    } catch (err) {
      await notice(explain(err));
    }
  }
</script>

<div class="center wide">
  <h1>{t('request.mine')}</h1>
  {#await overfin.requests()}
    <Skeleton kind="list" />
  {:then all}
    {@const shown = all.filter((r) => !cancelled.includes(r.id))}
    {#if !shown.length}
      <p class="muted">{t('request.none')}</p>
    {:else}
      <ul class="list requests">
        {#each shown as r (r.id)}
          <li>
            <a class="thumb" href="/title/{r.title.id}">
              {#if r.title.images?.primary}
                <img src={overfin.imageUrl(r.title.images.primary, 'small')} alt="" loading="lazy" use:loaded />
              {/if}
            </a>
            <div class="what">
              <a href="/title/{r.title.id}"><strong>{r.title.name}</strong></a>
              {#if r.title.year}<span class="muted"> ({r.title.year})</span>{/if}
              <div class="muted small">
                {#if r.seasons?.length}{t('request.seasons', { list: r.seasons.join(', ') })} · {/if}
                {new Date(r.requestedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                {#if r.profileName} · {t('request.by', { name: r.profileName })}{/if}
              </div>
            </div>
            <span class="chip status {r.status}">{t(`request.status.${r.status}` as Key)}</span>
            {#if r.status === 'pending'}
              <button onclick={() => cancel(r)}>{t('request.cancel')}</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {:catch error}
    <PageError {error} />
  {/await}
</div>
