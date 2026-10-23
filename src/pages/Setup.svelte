<!-- Setting the account up: a fresh one, or, when the server offers it,
     bringing one from the service this site replaces. People may never have
     heard of the software underneath, so the wording is about their
     previous account. With several languages offered, the account's is
     chosen here too; the page shows itself in it at once. -->
<script lang="ts">
  import { explain, OverfinError, overfin } from '../lib/client';
  import { i18n, t } from '../lib/i18n.svelte';

  let { claim, languages, language, done }: {
    claim?: 'copy'; languages: { tag: string; name: string }[]; language: string; done: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let chosen = $state(language);

  // finish saves the language chosen, when it isn't the one the account got.
  async function finish(got: string) {
    if (languages.length > 1 && chosen && chosen !== got) await overfin.setLanguage(chosen);
    done();
  }

  let message = $state('');
  let username = $state('');
  let password = $state('');

  async function create() {
    message = '';
    try {
      const me = await overfin.createAccount();
      await finish(me.language);
    } catch (err) {
      message = explain(err);
    }
  }

  async function bring(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    try {
      const me = await overfin.claimAccount(username, password);
      password = '';
      await finish(me.language);
    } catch (err) {
      message = err instanceof OverfinError && err.status === 404 ? t('setup.notOffered') : explain(err);
    }
  }
</script>

<div class="center setup">
  <h1>{t('setup.welcome')}</h1>
  {#if languages.length > 1}
    <label class="language">
      {t('app.language')}
      <select bind:value={chosen} onchange={() => i18n.follow(chosen)}>
        {#each languages as l (l.tag)}<option value={l.tag}>{l.name}</option>{/each}
      </select>
    </label>
  {/if}
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

<style>
  .language { display: flex; gap: .6rem; align-items: center; justify-content: center; margin-bottom: 1rem; }
</style>
