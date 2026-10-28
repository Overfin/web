<!-- The account: how one signs in (with Overfin's own sign-in), downloading
     one's data, bringing a history from the service this site replaces,
     deleting the account. Changes need a fresh login, or the profile's
     PIN. -->
<script lang="ts">
  import { explain, overfin } from '../lib/client';
  import { confirmed } from '../lib/confirmed';
  import { confirm, notice } from '../lib/dialog.svelte';
  import { homeChanged } from '../lib/homecache';
  import { i18n, t } from '../lib/i18n.svelte';
  import { session, setPicked } from '../lib/session.svelte';
  import Modal from '../components/Modal.svelte';
  import TastesForm from '../components/TastesForm.svelte';

  let message = $state('');
  const profile = $derived(session.me?.activeProfile);

  // How the account holder signs in, with Overfin's own sign-in only (the
  // server answers 404 otherwise, and the section stays hidden).
  let signin = $state<{ email: string; hasPassword: boolean; reset: boolean } | null>(null);
  let editing = $state(false);
  let newPassword = $state('');
  overfin.signinInfo().then((s) => (signin = s), () => {});

  // The account's language, among those offered: the owner's to change, and
  // applied only once saved.
  // svelte-ignore state_referenced_locally
  let language = $state(session.me?.language ?? '');

  async function saveLanguage() {
    message = '';
    try {
      session.me = await overfin.setLanguage(language);
      i18n.follow(session.me.language);
      homeChanged(); // titles kept in the tab are in the old language
      await notice(t('account.languageSaved'));
    } catch (err) {
      message = explain(err);
    }
  }

  // This profile's look: it applies at once, and each profile chooses its
  // own.
  // svelte-ignore state_referenced_locally
  let theme = $state<'' | 'light' | 'dark'>(profile?.theme ?? '');

  async function saveTheme() {
    if (!profile) return;
    message = '';
    try {
      const changed = await overfin.updateProfile(profile.id, { theme });
      if (session.me) session.me.activeProfile = changed;
    } catch (err) {
      message = explain(err);
    }
  }

  // Bringing the history of a previous account into this profile, when the
  // server offers it (once per account; never to kids profiles).
  let bring = $state(false);
  let bringing = $state(false);
  let username = $state('');
  let password = $state('');
  overfin.historyCopy().then((h) => (bring = h.available), () => {});

  async function copyHistory(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    try {
      await overfin.copyHistory(username, password);
      homeChanged();
      password = '';
      bring = false;
      bringing = false;
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
      homeChanged();
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
          {t('account.signinPassword', { email: signin.email })}
        </p>
      </div>
      <div class="actions">
        <button onclick={() => { message = ''; editing = true; }}>{t('account.changePassword')}</button>
      </div>
    </div>
    <!-- A new password, in a window. -->
    {#if editing}
      <Modal title={t('account.changePassword')} close={() => (editing = false)}>
        <form class="stack" onsubmit={savePassword}>
          <!-- svelte-ignore a11y_autofocus -->
          <input type="password" autocomplete="new-password" minlength="10" maxlength="256" required autofocus
            aria-label={t('account.newPassword')} placeholder={t('account.newPassword')} bind:value={newPassword} />
          {#if message}<p class="error">{message}</p>{/if}
          <div class="actions">
            <button type="button" onclick={() => (editing = false)}>{t('common.cancel')}</button>
            <button class="primary" type="submit">{t('account.savePassword')}</button>
          </div>
        </form>
      </Modal>
    {/if}
  {/if}
  {#if profile?.owner && (session.me?.languages.length ?? 0) > 1}
    <div class="panel setting">
      <div>
        <h2>{t('app.language')}</h2>
        <p class="muted">{t('account.languageText')}</p>
      </div>
      <div class="actions">
        <select bind:value={language} aria-label={t('app.language')}>
          {#each session.me?.languages ?? [] as l (l.tag)}<option value={l.tag}>{l.name}</option>{/each}
        </select>
        <button class="primary" disabled={language === session.me?.language} onclick={saveLanguage}>{t('account.languageSave')}</button>
      </div>
    </div>
  {/if}
  {#if profile?.owner && session.me?.tastes?.asked}
    <div class="panel">
      <h2>{t('account.tastesTitle')}</h2>
      <p class="muted">{t('account.tastesText')}</p>
      <TastesForm done={() => notice(t('tastes.saved'))} />
    </div>
  {/if}
  {#if profile}
    <div class="panel setting">
      <div>
        <h2>{t('account.themeTitle')}</h2>
        <p class="muted">{t('account.themeText')}</p>
      </div>
      <select bind:value={theme} onchange={saveTheme} aria-label={t('account.themeTitle')}>
        <option value="">{t('account.themeDevice')}</option>
        <option value="light">{t('account.themeLight')}</option>
        <option value="dark">{t('account.themeDark')}</option>
      </select>
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
    <div class="panel setting">
      <div>
        <h2>{t('account.bringTitle')}</h2>
        <p class="muted">{t('account.bringText')}</p>
      </div>
      <button onclick={() => { message = ''; bringing = true; }}>{t('account.bring')}</button>
    </div>
    <!-- The previous account's login, in a window. -->
    {#if bringing}
      <Modal title={t('account.bringTitle')} close={() => (bringing = false)}>
        <form class="stack" onsubmit={copyHistory}>
          <p class="muted">{t('account.bringText')}</p>
          <input bind:value={username} name="username" autocomplete="username" required aria-label={t('setup.username')} placeholder={t('setup.username')} />
          <input bind:value={password} name="password" type="password" autocomplete="current-password" required aria-label={t('setup.password')} placeholder={t('setup.password')} />
          {#if message}<p class="error">{message}</p>{/if}
          <div class="actions">
            <button type="button" onclick={() => (bringing = false)}>{t('common.cancel')}</button>
            <button class="primary" type="submit">{t('account.bring')}</button>
          </div>
        </form>
      </Modal>
    {/if}
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
  .actions { display: flex; flex-wrap: wrap; gap: .6rem; flex: none; }
</style>
