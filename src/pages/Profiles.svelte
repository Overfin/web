<!-- "Who's watching?": choosing a profile (with its PIN, if it has one),
     and, for the owner, adding one. -->
<script lang="ts">
  import type { Profile } from '../lib/sdk/overfin.js';
  import { explain, isError, overfin } from '../lib/client';
  import { askPin } from '../lib/dialog.svelte';
  import { t, tn } from '../lib/i18n.svelte';
  import { go } from '../lib/router.svelte';
  import { refresh, session, setPicked } from '../lib/session.svelte';
  import AgePicker from '../components/AgePicker.svelte';
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
  let name = $state('');
  let kids = $state(false);
  let age = $state(8);

  async function startAdding() {
    message = '';
    age = 8;
    name = '';
    kids = false;
    adding = true;
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    try {
      await overfin.createProfile(kids ? { name, kind: 'kids', maxAge: age } : { name });
      adding = false;
      reload++;
      // The streams shared among profiles change with their number.
      session.me = await overfin.me().catch(() => session.me);
    } catch (err) {
      message = explain(err);
    }
  }
</script>

{#if adding}
  <div class="center">
    <h1>{t('profiles.new')}</h1>
    <form class="stack panel" onsubmit={add}>
      <label>{t('manage.name')} <input bind:value={name} maxlength="32" required /></label>
      <label class="check"><input type="checkbox" bind:checked={kids} /> {t('manage.kidsProfile')}</label>
      {#if kids}<AgePicker bind:age />{/if}
      <button class="primary" type="submit">{t('common.create')}</button>
      <button type="button" onclick={() => (adding = false)}>{t('common.cancel')}</button>
    </form>
    {#if message}<p class="error">{message}</p>{/if}
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
      {#if session.me?.activeProfile?.owner && !(session.me.limits?.maxProfiles > 0 && list.length >= session.me.limits.maxProfiles)}
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
