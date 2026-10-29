<!-- The bar on top of every screen except the profile picker, account setup
     and the player: home, discovery, the operator's categories, and the
     libraries unless the operator took them out (one item, however
     many there are), then a menu for who's watching (the profile's list,
     switching, managing profiles, the account, the control panel for
     admins, logging out).
     On phones the sections open from a button on the left, as a list under
     the header; it closes with a tap outside, Escape, or going somewhere. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { librariesHref } from '../lib/lastlibrary';
  import { categoryIdOf, categoryPath } from '../lib/paths';
  import Brand from './Brand.svelte';
  import { router } from '../lib/router.svelte';
  import { session, setPicked } from '../lib/session.svelte';

  const here = $derived(router.route.parts);
  const name = $derived(session.me?.activeProfile?.name ?? t('nav.chooseProfile'));
  // Where Libraries leads: read again as the address changes.
  const libraries = $derived((void router.route, librariesHref(session.libraries)));

  // The control panel, for admins, when the server gives its address (a
  // web address only).
  const panel = $derived.by(() => {
    const url = session.me?.panel;
    if (!url) return '';
    try {
      return ['http:', 'https:'].includes(new URL(url, location.href).protocol) ? url : '';
    } catch {
      return '';
    }
  });

  let open = $state(false);
  let sections = $state<HTMLElement>();
  // Whether the sections' line has more to either side (phones).
  let moreLeft = $state(false);
  let moreRight = $state(false);

  function edges() {
    if (!sections) return;
    moreLeft = sections.scrollLeft > 1;
    moreRight = sections.scrollLeft + sections.clientWidth < sections.scrollWidth - 1;
  }

  // The open section in view, as the address or the sections change.
  $effect(() => {
    void router.route;
    void session.categories;
    void session.libraries;
    void session.collections;
    tick().then(() => {
      const active = sections?.querySelector<HTMLElement>('a.active');
      if (sections && active && sections.scrollWidth > sections.clientWidth) {
        sections.scrollLeft = active.offsetLeft - sections.offsetLeft - (sections.clientWidth - active.offsetWidth) / 2;
      }
      edges();
    });
  });
  let menu: HTMLDivElement;
  let toggle: HTMLButtonElement;
  // The sections' list, on phones.
  let sectionsOpen = $state(false);
  let sectionsToggle = $state<HTMLButtonElement>();

  // The menus close when the address changes.
  $effect(() => {
    void router.route;
    open = false;
    sectionsOpen = false;
  });

  function outside(event: MouseEvent) {
    const target = event.target as Node;
    if (open && !menu.contains(target)) open = false;
    if (sectionsOpen && !sections?.contains(target) && !sectionsToggle?.contains(target)) sectionsOpen = false;
  }

  function keydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (open) {
      open = false;
      toggle.focus();
    } else if (sectionsOpen) {
      sectionsOpen = false;
      sectionsToggle?.focus();
    }
  }

  async function logout() {
    setPicked(false);
    const out = await overfin.logout().catch(() => ({ logoutUrl: undefined }));
    location.href = out.logoutUrl || '/';
  }

  // The search icon, from another page, starts a new search: the words of
  // the last one are forgotten (Back to the search keeps them, in its
  // address; on the search page, nothing changes).
  function newSearch(event: MouseEvent) {
    if (here[0] === 'search') {
      // A new tab still opens one, empty.
      if (!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) event.preventDefault();
      return;
    }
    try {
      sessionStorage.removeItem('overfin-web-search');
    } catch {
      // nothing kept
    }
  }
</script>

<svelte:window onclick={outside} onkeydown={keydown} onresize={edges} />

<header data-theme="dark">
  <!-- Phones: the sections behind a button. -->
  <button class="sections-toggle" type="button" bind:this={sectionsToggle} aria-expanded={sectionsOpen} aria-controls="sections"
    aria-label={t('nav.sections')} title={t('nav.sections')} onclick={() => (sectionsOpen = !sectionsOpen)}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={sectionsOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
  </button>
  <Brand />
  <nav id="sections" bind:this={sections} class:open={sectionsOpen} class:more-left={moreLeft} class:more-right={moreRight} onscroll={edges}>
    <a href="/" data-text={t('nav.home')} class:active={here.length === 0} aria-current={here.length === 0 ? 'page' : undefined}>{t('nav.home')}</a>
    {#if session.discovery}
      <a href="/discover" data-text={t('nav.discover')} class:active={here[0] === 'discover'} aria-current={here[0] === 'discover' ? 'page' : undefined}>{t('nav.discover')}</a>
    {/if}
    {#each session.categories as c (c.id)}
      {@const on = here[0] === 'category' && categoryIdOf(here[1], session.categories) === c.id}
      <a href={categoryPath(c, session.categories)} data-text={c.name} class:active={on} aria-current={on ? 'page' : undefined}>{c.name}</a>
    {/each}
    {#if !session.librariesShown}
      <!-- The operator's categories alone. -->
    {:else if session.libraries.length === 1}
      <a href="/library/{session.libraries[0].id}" data-text={session.libraries[0].name} class:active={here[0] === 'library'}>{session.libraries[0].name}</a>
    {:else if libraries}
      <a href={libraries} data-text={t('nav.libraries')} class:active={here[0] === 'library'}>{t('nav.libraries')}</a>
    {/if}
    {#if session.collections.length}
      <!-- Last: series of films, from TMDB. -->
      <a href="/collections" data-text={t('nav.collections')} class:active={here[0] === 'collections' || here[0] === 'collection'}
        aria-current={here[0] === 'collections' ? 'page' : undefined}>{t('nav.collections')}</a>
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
        <a href="/list">{t('nav.list')}</a>
        <a href="/profiles">{t('nav.switchProfile')}</a>
        {#if session.requests}<a href="/requests">{t('request.mine')}</a>{/if}
        <a href="/manage">{t('nav.profiles')}</a>
        <a href="/account">{t('nav.account')}</a>
        <!-- Not one of the site's pages: target="_self" has the browser
             open it, in this tab. -->
        {#if panel}<a href={panel} target="_self">{t('nav.panel')}</a>{/if}
        <button type="button" onclick={logout}>{t('nav.logout')}</button>
      </div>
    {/if}
  </div>
</header>
