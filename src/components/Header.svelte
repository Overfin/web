<!-- The bar on top of every screen except the profile picker, account setup
     and the player: home, the profile's list, discovery, the operator's categories, and the
     libraries unless the operator took them out (one item, however
     many there are), then a menu for who's watching (switching, managing
     profiles, the account, logging out). On phones the sections go to a
     second, scrolling line. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { librariesHref } from '../lib/lastlibrary';
  import Brand from './Brand.svelte';
  import { router } from '../lib/router.svelte';
  import { session, setPicked } from '../lib/session.svelte';

  const here = $derived(router.route.parts);
  const name = $derived(session.me?.activeProfile?.name ?? t('nav.chooseProfile'));
  // Where Libraries leads: read again as the address changes.
  const libraries = $derived((void router.route, librariesHref(session.libraries)));

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
  <Brand />
  <nav>
    <a href="/" class:active={here.length === 0}>{t('nav.home')}</a>
    <a href="/list" class:active={here[0] === 'list'}>{t('nav.list')}</a>
    {#if session.discovery}
      <a href="/discover" class:active={here[0] === 'discover'}>{t('nav.discover')}</a>
    {/if}
    {#each session.categories as c (c.id)}
      <a href="/category/{c.id}" class:active={here[0] === 'category' && here[1] === c.id}>{c.name}</a>
    {/each}
    {#if !session.librariesShown}
      <!-- The operator's categories alone. -->
    {:else if session.libraries.length === 1}
      <a href="/library/{session.libraries[0].id}" class:active={here[0] === 'library'}>{session.libraries[0].name}</a>
    {:else if libraries}
      <a href={libraries} class:active={here[0] === 'library'}>{t('nav.libraries')}</a>
    {/if}
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
        <button type="button" onclick={logout}>{t('nav.logout')}</button>
      </div>
    {/if}
  </div>
</header>
