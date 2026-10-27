<!-- The whole site: who's here first (account setup, no access, or "Who's
     watching?"), then the screen the address names. -->
<script lang="ts">
  import { explain, isError, overfin } from './lib/client';
  import { i18n, t } from './lib/i18n.svelte';
  import { go, router } from './lib/router.svelte';
  import { loadCategories, offersDiscovery, offersRequests, picked, session } from './lib/session.svelte';
  import { applyTheme, rememberTheme } from './lib/theme';
  import Brand from './components/Brand.svelte';
  import Dialog from './components/Dialog.svelte';
  import SiteFooter from './components/SiteFooter.svelte';
  import Header from './components/Header.svelte';
  import PageError from './components/PageError.svelte';
  import Skeleton from './components/Skeleton.svelte';
  import Account from './pages/Account.svelte';
  import Discover from './pages/Discover.svelte';
  import Home from './pages/Home.svelte';
  import Library from './pages/Library.svelte';
  import Manage from './pages/Manage.svelte';
  import Player from './pages/Player.svelte';
  import PersonPage from './pages/PersonPage.svelte';
  import Profiles from './pages/Profiles.svelte';
  import Requests from './pages/Requests.svelte';
  import Search from './pages/Search.svelte';
  import Setup from './pages/Setup.svelte';
  import TitlePage from './pages/TitlePage.svelte';
  import TastesForm from './components/TastesForm.svelte';

  type Phase =
    | { kind: 'loading' }
    | { kind: 'setup'; claim?: 'copy'; languages: { tag: string; name: string }[]; language: string }
    | { kind: 'blocked'; title: string; message: string }
    | { kind: 'tastes' }
    | { kind: 'ready' };
  let phase = $state<Phase>({ kind: 'loading' });

  async function start() {
    phase = { kind: 'loading' };
    try {
      session.me = await overfin.me();
      i18n.follow(session.me.language);
    } catch (err) {
      if (isError(err, 'account-setup-required')) {
        if (err.problem.language) i18n.follow(err.problem.language);
        phase = { kind: 'setup', claim: err.problem.claim, languages: err.problem.languages ?? [], language: err.problem.language ?? '' };
      } else if (isError(err, 'account-not-allowed')) phase = { kind: 'blocked', title: t('access.none'), message: explain(err) };
      else if (isError(err, 'invitation-required')) phase = { kind: 'blocked', title: t('access.invitation'), message: explain(err) };
      else phase = { kind: 'blocked', title: '', message: explain(err) };
      return;
    }
    let libraries, profiles;
    try {
      [libraries, profiles] = await Promise.all([overfin.libraries().catch(() => []), overfin.profiles()]);
    } catch (err) {
      phase = { kind: 'blocked', title: '', message: explain(err) };
      return;
    }
    session.libraries = libraries;
    [session.discovery, session.requests] = await Promise.all([offersDiscovery(), offersRequests(), loadCategories()]);
    session.kidsNeedLimits = profiles.some((p) => p.ceilingsNeeded) && !!session.me.activeProfile?.owner;
    // "Who's watching?" once per tab, when there's a choice.
    const where = router.route.parts[0];
    if ((!session.me.activeProfile || (profiles.length > 1 && !picked())) && where !== 'play' && where !== 'profiles') {
      go('/profiles');
    }
    // Once, on the owner profile: what the account likes, when the server
    // asks.
    const tastes = session.me.tastes;
    if (tastes?.asked && !tastes.answered && session.me.activeProfile?.owner && where !== 'play') {
      phase = { kind: 'tastes' };
      return;
    }
    phase = { kind: 'ready' };
  }
  start();

  const route = $derived(router.route);
  // Each address is a screen of its own: shown anew when it changes.
  const key = $derived(route.parts.join('/') + '?' + route.params.toString());
  const bare = $derived(route.parts[0] === 'profiles' || route.parts[0] === 'play');

  // loadingShape is the placeholder that looks like the page at a path.
  function loadingShape(where: string | undefined): { kind: 'home' | 'title' | 'grid' | 'rows'; heading?: boolean } {
    if (!where) return { kind: 'home' };
    if (where === 'title' || where === 'person') return { kind: 'title' };
    if (where === 'library') return { kind: 'grid', heading: true };
    return { kind: 'rows', heading: true };
  }

  $effect(() => {
    void key;
    window.scrollTo(0, 0);
  });

  // The active profile's look, once it's known; the player is always dark.
  $effect(() => {
    if (!session.me) return;
    const theme = session.me.activeProfile?.theme;
    applyTheme(route.parts[0] === 'play' ? 'dark' : theme);
    rememberTheme(theme);
  });
</script>

{#if phase.kind === 'loading'}
  <!-- The page's own shape while the session loads, under a header with
       the brand only, so nothing moves once it's there. -->
  <header>
    <Brand />
    <nav class="placeholder" aria-hidden="true"></nav>
  </header>
  <main><Skeleton {...loadingShape(route.parts[0])} /></main>
{:else if phase.kind === 'setup'}
  <main><Setup claim={phase.claim} languages={phase.languages} language={phase.language} done={start} /></main>
{:else if phase.kind === 'tastes'}
  <main>
    <div class="center">
      <TastesForm first done={() => {
        if (session.me) session.me.tastes = { asked: true, answered: true };
        phase = { kind: 'ready' };
      }} />
    </div>
  </main>
{:else if phase.kind === 'blocked'}
  <main>
    <div class="center">
      {#if phase.title}<h1>{phase.title}</h1>{/if}
      <p>{phase.message}</p>
    </div>
  </main>
{:else}
  {#if !bare}<Header />{/if}
  <main>
    <!-- A kids profile without limits shows nothing: its owner is asked to
         choose them. -->
    {#if !bare && session.me?.activeProfile?.ceilingsNeeded}
      <p class="notice">{t('notice.noLimits')}</p>
    {:else if !bare && session.kidsNeedLimits && route.parts[0] !== 'manage'}
      <p class="notice">{t('notice.kidsNeedLimits')} <a href="/manage">{t('notice.chooseLimits')}</a></p>
    {/if}
    {#key key}
      {#if route.parts.length === 0}
        <Home />
      {:else if route.parts[0] === 'library' && route.parts[1]}
        <Library id={route.parts[1]} params={route.params} />
      {:else if route.parts[0] === 'category' && route.parts[1]}
        <Library id={route.parts[1]} params={route.params} category />
      {:else if route.parts[0] === 'discover'}
        <Discover />
      {:else if route.parts[0] === 'title' && route.parts[1]}
        <TitlePage id={route.parts[1]} params={route.params} />
      {:else if route.parts[0] === 'play' && route.parts[1]}
        <!-- A new player for each title, as the next episode replaces one. -->
        {#key route.parts[1]}<Player id={route.parts[1]} />{/key}
      {:else if route.parts[0] === 'profiles'}
        <Profiles />
      {:else if route.parts[0] === 'manage'}
        <Manage />
      {:else if route.parts[0] === 'person' && route.parts[1]}
        <PersonPage id={route.parts[1]} />
      {:else if route.parts[0] === 'search'}
        <Search />
      {:else if route.parts[0] === 'requests'}
        <Requests />
      {:else if route.parts[0] === 'account'}
        <Account />
      {:else}
        <PageError notFound />
      {/if}
    {/key}
  </main>
{/if}
{#if route.parts[0] !== 'play'}<SiteFooter tmdb={route.parts.length === 0} />{/if}
<Dialog />
