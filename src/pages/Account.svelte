<!-- The account: how one signs in (with Overfin's own sign-in), downloading
     one's data, bringing a history from the service this site replaces,
     deleting the account. Changes need a fresh login, or the profile's
     PIN. -->
<script lang="ts">
  import { explain, overfin } from '../lib/client';
  import { confirmed } from '../lib/confirmed';
  import { confirm, notice } from '../lib/dialog.svelte';
  import { t } from '../lib/i18n.svelte';
  import { session, setPicked } from '../lib/session.svelte';

  let message = $state('');
  const profile = $derived(session.me?.activeProfile);

  // How the account holder signs in, with Overfin's own sign-in only (the
  // server answers 404 otherwise, and the section stays hidden).
  let signin = $state<{ email: string; hasPassword: boolean; codes: boolean } | null>(null);
  let editing = $state(false);
  let newPassword = $state('');
  overfin.signinInfo().then((s) => (signin = s), () => {});

  // Bringing the history of a previous account into this profile, when the
  // server offers it (once per account; never to kids profiles).
  let bring = $state(false);
  let username = $state('');
  let password = $state('');
  overfin.historyCopy().then((h) => (bring = h.available), () => {});

  async function copyHistory(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    try {
      await overfin.copyHistory(username, password);
      password = '';
      bring = false;
      await notice(t('account.brought'));
    } catch (err) {
      message = explain(err);
    }
  }

  async function savePassword(event: SubmitEvent) {
    event.preventDefault();
    if (await confirmed(() => overfin.setPassword(newPassword), (m) => (message = m))) {
      signin = signin && { ...signin, hasPassword: true };
      editing = false;
      newPassword = '';
      await notice(t('account.passwordSaved'));
    }
  }

  async function removePassword() {
    if (!(await confirm(t('account.removeConfirm'), true))) return;
    if (await confirmed(() => overfin.removePassword(), (m) => (message = m))) {
      signin = signin && { ...signin, hasPassword: false };
      await notice(t('account.passwordRemoved'));
    }
  }

  async function download() {
    await confirmed(async (pin) => {
      const data = await overfin.exportData(pin);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'my-data.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, (m) => (message = m));
  }

  async function clearHistory() {
    if (!(await confirm(t('account.clearConfirm'), true))) return;
    try {
      await overfin.clearHistory();
      await notice(t('account.cleared'));
    } catch (err) {
      message = explain(err);
    }
  }

  async function remove() {
    if (!(await confirm(t('account.deleteConfirm'), true))) return;
    await confirmed(async () => {
      const out = await overfin.deleteAccount();
      setPicked(false);
      await notice(out.history === 'kept' ? t('account.deletedKept') : t('account.deleted'));
      location.href = '/';
    }, (m) => (message = m));
  }
</script>

<div class="center wide">
  <h1>{t('account.title')}</h1>
  {#if signin && profile?.owner}
    <div class="panel setting">
      <div>
        <h2>{t('account.signinTitle')}</h2>
        <p class="muted">
          {t(signin.hasPassword ? 'account.signinPassword' : signin.codes ? 'account.signinCode' : 'account.signinLink', { email: signin.email })}
        </p>
        {#if editing}
          <form class="password" onsubmit={savePassword}>
            <input type="password" autocomplete="new-password" minlength="10" maxlength="256" required
              aria-label={t('account.newPassword')} placeholder={t('account.newPassword')} bind:value={newPassword} />
            <button class="primary" type="submit">{t('account.savePassword')}</button>
            <button type="button" onclick={() => (editing = false)}>{t('common.cancel')}</button>
          </form>
        {/if}
      </div>
      {#if !editing}
        <div class="actions">
          {#if signin.hasPassword && signin.codes}
            <button onclick={removePassword}>{t('account.removePassword')}</button>
          {/if}
          <button onclick={() => (editing = true)}>{t(signin.hasPassword ? 'account.changePassword' : 'account.setPassword')}</button>
        </div>
      {/if}
    </div>
  {/if}
  {#if profile?.kind !== 'kids'}
    <div class="panel setting">
      <div>
        <h2>{t('account.dataTitle')}</h2>
        <p class="muted">{profile?.owner ? t('account.dataOwner') : t('account.dataProfile')}</p>
      </div>
      <button onclick={download}>{t('account.download')}</button>
    </div>
    <div class="panel setting">
      <div>
        <h2>{t('account.historyTitle')}</h2>
        <p class="muted">{t('account.historyText')}</p>
      </div>
      <button onclick={clearHistory}>{t('account.clearHistory')}</button>
    </div>
  {/if}
  {#if bring}
    <div class="panel">
      <h2>{t('account.bringTitle')}</h2>
      <p class="muted">{t('account.bringText')}</p>
      <form class="password" onsubmit={copyHistory}>
        <input bind:value={username} name="username" autocomplete="username" required aria-label={t('setup.username')} placeholder={t('setup.username')} />
        <input bind:value={password} name="password" type="password" autocomplete="current-password" required aria-label={t('setup.password')} placeholder={t('setup.password')} />
        <button class="primary" type="submit">{t('account.bring')}</button>
      </form>
    </div>
  {/if}
  {#if profile?.owner}
    <div class="panel setting danger-zone">
      <div>
        <h2>{t('account.deleteTitle')}</h2>
        <p class="muted">{t('account.deleteText')}</p>
      </div>
      <button class="danger" onclick={remove}>{t('account.delete')}</button>
    </div>
  {/if}
  {#if message}<p class="error">{message}</p>{/if}
</div>

<style>
  .password { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: .9rem; }
  .password input { flex: 1 1 16rem; min-width: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: .6rem; flex: none; }
</style>
