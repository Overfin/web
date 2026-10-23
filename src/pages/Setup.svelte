<!-- Setting the account up: a fresh one, or, when the server offers it,
     bringing one from the service this site replaces. People may never have
     heard of the software underneath, so the wording is about their
     previous account. -->
<script lang="ts">
  import { explain, OverfinError, overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';

  let { claim, done }: { claim?: 'copy'; done: () => void } = $props();

  let message = $state('');
  let username = $state('');
  let password = $state('');

  async function create() {
    message = '';
    try {
      await overfin.createAccount();
      done();
    } catch (err) {
      message = explain(err);
    }
  }

  async function bring(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    try {
      await overfin.claimAccount(username, password);
      password = '';
      done();
    } catch (err) {
      message = err instanceof OverfinError && err.status === 404 ? t('setup.notOffered') : explain(err);
    }
  }
</script>

<div class="center setup">
  <h1>{t('setup.welcome')}</h1>
  <div class="panel">
    <p>{t('setup.fresh')}</p>
    <button class="primary block" onclick={create}>{t('setup.create')}</button>
  </div>
  {#if claim}
    <div class="divider"><span>{t('setup.or')}</span></div>
    <div class="panel">
      <h2>{t('setup.bringTitle')}</h2>
      <p>{t('setup.bringIntro')}</p>
      <p class="muted">{t('setup.copyNote')}</p>
      <form class="stack" onsubmit={bring}>
        <label>{t('setup.username')} <input bind:value={username} name="username" autocomplete="username" required /></label>
        <label>{t('setup.password')} <input bind:value={password} name="password" type="password" autocomplete="current-password" required /></label>
        <button class="block" type="submit">{t('setup.bring')}</button>
      </form>
    </div>
  {/if}
  {#if message}<p class="error">{message}</p>{/if}
</div>
