<!-- The bar on top of every screen except the profile picker, account setup
     and the player: home, discovery and the libraries, then a menu for who's
     watching (switching, managing profiles, the account, the language,
     logging out). On phones the libraries go to a second, scrolling line. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { i18n, locales, t, type Locale } from '../lib/i18n.svelte';
  import { router } from '../lib/router.svelte';
  import { session, setPicked } from '../lib/session.svelte';

  const here = $derived(router.route.parts);
  const name = $derived(session.me?.activeProfile?.name ?? t('nav.chooseProfile'));

  let open = $state(false);
  let menu: HTMLDivElement;
  let toggle: HTMLButtonElement;

  // The menu closes when the address changes.
  $effect(() => {
    void router.route;
    open = false;
  });

  function outside(event: MouseEvent) {
    if (open && !menu.contains(event.target as Node)) open = false;
  }

  function keydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      open = false;
      toggle.focus();
    }
  }

  async function logout() {
    setPicked(false);
    const out = await overfin.logout().catch(() => ({ logoutUrl: undefined }));
    location.href = out.logoutUrl || '/';
  }

  // The search icon, from another page, starts a new search: the words of
  // the last one are forgotten (Back to the search keeps them; on the
  // search page, nothing changes).
  function newSearch() {
    if (here[0] === 'search') return;
    try {
      sessionStorage.removeItem('overfin-web-search');
    } catch {
      // nothing kept
    }
  }
</script>

<svelte:window onclick={outside} onkeydown={keydown} />

<header>
  <a class="brand" href="/"><img src="/logo.svg" alt="" width="30" height="30" />Overfin</a>
  <nav>
    <a href="/" class:active={here.length === 0}>{t('nav.home')}</a>
    {#if session.discovery}
      <a href="/discover" class:active={here[0] === 'discover'}>{t('nav.discover')}</a>
    {/if}
    {#each session.libraries as library (library.id)}
      <a href="/library/{library.id}" class:active={here[0] === 'library' && here[1] === library.id}>{library.name}</a>
    {/each}
  </nav>
  <a class="search-link" href="/search" aria-label={t('search.label')} title={t('search.label')} class:active={here[0] === 'search'}
    onclick={newSearch}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.9 10.6l4.2 4.2 1.4-1.4-4.2-4.2A6 6 0 0 0 10 4m0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8" /></svg>
  </a>
  <div class="menu" bind:this={menu}>
    <button class="who" type="button" bind:this={toggle} aria-expanded={open} aria-label={t('nav.menu')}
      onclick={() => (open = !open)}>
      <span class="avatar small" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <span class="name">{name}</span>
    </button>
    {#if open}
      <div class="dropdown">
        <a href="/profiles">{t('nav.switchProfile')}</a>
        {#if session.requests}<a href="/requests">{t('request.mine')}</a>{/if}
        <a href="/manage">{t('nav.profiles')}</a>
        <a href="/account">{t('nav.account')}</a>
        <label>
          {t('app.language')}
          <select value={i18n.locale} onchange={(event) => i18n.set(event.currentTarget.value as Locale)}>
            {#each locales as locale (locale.code)}
              <option value={locale.code}>{locale.name}</option>
            {/each}
          </select>
        </label>
        <button type="button" onclick={logout}>{t('nav.logout')}</button>
      </div>
    {/if}
  </div>
</header>
