<!-- The whole site: who's here first (account setup, no access, or "Who's
     watching?"), then the screen the address names. -->
<script lang="ts">
  import { explain, isError, overfin } from './lib/client';
  import { t } from './lib/i18n.svelte';
  import { go, router } from './lib/router.svelte';
  import { offersDiscovery, offersRequests, picked, session } from './lib/session.svelte';
  import Dialog from './components/Dialog.svelte';
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

  type Phase =
    | { kind: 'loading' }
    | { kind: 'setup'; claim?: 'move' | 'link' }
    | { kind: 'blocked'; title: string; message: string }
    | { kind: 'ready' };
  let phase = $state<Phase>({ kind: 'loading' });

  async function start() {
    phase = { kind: 'loading' };
    try {
      session.me = await overfin.me();
    } catch (err) {
      if (isError(err, 'account-setup-required')) phase = { kind: 'setup', claim: err.problem.claim };
      else if (isError(err, 'account-not-allowed')) phase = { kind: 'blocked', title: t('access.none'), message: explain(err) };
      else if (isError(err, 'invitation-required')) phase = { kind: 'blocked', title: t('access.invitation'), message: explain(err) };
      else phase = { kind: 'blocked', title: '', message: explain(err) };
      return;
    }
    const [libraries, profiles] = await Promise.all([overfin.libraries().catch(() => []), overfin.profiles()]);
    session.libraries = libraries;
    [session.discovery, session.requests] = await Promise.all([offersDiscovery(), offersRequests()]);
    session.kidsNeedLimits = profiles.some((p) => p.ceilingsNeeded) && !!session.me.activeProfile?.owner;
    // "Who's watching?" once per tab, when there's a choice.
    const where = router.route.parts[0];
    if ((!session.me.activeProfile || (profiles.length > 1 && !picked())) && where !== 'play' && where !== 'profiles') {
      go('/profiles');
    }
    phase = { kind: 'ready' };
  }
  start();

  const route = $derived(router.route);
  // Each address is a screen of its own: shown anew when it changes.
  const key = $derived(route.parts.join('/') + '?' + route.params.toString());
  const bare = $derived(route.parts[0] === 'profiles' || route.parts[0] === 'play');

  $effect(() => {
    void key;
    window.scrollTo(0, 0);
  });
</script>

{#if phase.kind === 'loading'}
  <main><Skeleton /></main>
{:else if phase.kind === 'setup'}
  <main><Setup claim={phase.claim} done={start} /></main>
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
      {:else if route.parts[0] === 'discover'}
        <Discover />
      {:else if route.parts[0] === 'title' && route.parts[1]}
        <TitlePage id={route.parts[1]} params={route.params} />
      {:else if route.parts[0] === 'play' && route.parts[1]}
        <Player id={route.parts[1]} />
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
<Dialog />
