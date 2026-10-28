<!-- "Who's watching?": choosing a profile (with its PIN, if it has one),
     and, for the owner, adding one. -->
<script lang="ts">
  import type { Profile } from '../lib/sdk/overfin.js';
  import { explain, isError, overfin } from '../lib/client';
  import { askPin } from '../lib/dialog.svelte';
  import { t, tn } from '../lib/i18n.svelte';
  import { go } from '../lib/router.svelte';
  import { mayAddProfile, refresh, session, setPicked } from '../lib/session.svelte';
  import NewProfile from '../components/NewProfile.svelte';
  import PageError from '../components/PageError.svelte';

  let message = $state('');
  let reload = $state(0);
  const profiles = $derived.by(() => {
    void reload;
    return overfin.profiles();
  });

  async function choose(p: Profile, pin?: string) {
    message = '';
    if (p.hasPin && pin === undefined) {
      const entered = await askPin(t('profiles.pinFor', { name: p.name }));
      if (entered === null) return;
      pin = entered;
    }
    try {
      await overfin.activateProfile(p.id, pin);
      setPicked(true);
      await refresh();
      go('/');
    } catch (err) {
      // A PIN set since the list was read: ask it, once; the list is read
      // again too.
      if (isError(err, 'pin-required') && pin === undefined) {
        reload++;
        return choose({ ...p, hasPin: true });
      }
      message = explain(err);
    }
  }

  // Adding a profile, for the owner.
  let adding = $state(false);

  function startAdding() {
    message = '';
    adding = true;
  }
</script>

{#if adding}
  <div class="center">
    <h1>{t('profiles.new')}</h1>
    <div class="panel">
      <NewProfile created={() => { adding = false; reload++; }} cancel={() => (adding = false)} />
    </div>
  </div>
{:else}
  <h1 class="center">{t('profiles.who')}</h1>
  {#await profiles}
    <p class="center muted">{t('app.loading')}</p>
  {:then list}
    <div class="profiles">
      {#each list as p (p.id)}
        <button class="profile" onclick={() => choose(p)}>
          <div class="avatar">{p.name.slice(0, 1).toUpperCase()}</div>
          {p.name}
          <div class="badge">
            {[p.kind === 'kids' ? t('profiles.kids') : '', p.hasPin ? '🔒' : ''].filter(Boolean).join(' ')}
          </div>
        </button>
      {/each}
      {#if mayAddProfile(list.length)}
        <button class="profile" onclick={startAdding}><div class="avatar">+</div>{t('profiles.add')}</button>
      {/if}
    </div>
    {#if message}<p class="center error">{message}</p>{/if}
    <!-- With a stream reserved for each profile: how it works, and that an
         unused profile keeps one. -->
    {#if session.me?.limits?.reservedStreams}
      <p class="center muted">{tn('profiles.reserved', session.me.limits.sharedStreams)}</p>
    {/if}
    <!-- Managing needs a profile: shown once one is active. -->
    {#if session.me?.activeProfile}
      <p class="center">
        <a class="button" href="/manage">{session.me.activeProfile.owner ? t('profiles.manage') : t('profiles.mine')}</a>
      </p>
    {/if}
  {:catch error}
    <PageError {error} />
  {/await}
{/if}
