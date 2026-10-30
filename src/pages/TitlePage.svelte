<!-- A title, in a library or not: a film, a series, a season or an episode.
     Everything about it (text, images, cast) is TMDB's; the library only
     decides whether it plays. A series shows its seasons as a row of
     posters, with the chosen season's episodes, those no library has too;
     an episode shows its season's poster. -->
<script lang="ts">
  import { homeChanged } from '../lib/homecache';
  import { similarOf, titleOf } from '../lib/titlecache';
  import type { Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { explain, overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { backdropOf } from '../lib/backdrop.svelte';
  import { collectionPath, correct, personPath, titleIdOf, titlePath, titlePathOf } from '../lib/paths';
  import { ageText, clock, duration } from '../lib/format';
  import { t, tn, type Key } from '../lib/i18n.svelte';
  import { confirm, notice } from '../lib/dialog.svelte';
  import { play } from '../lib/play';
  import { score } from '../lib/score';
  import { ask } from '../lib/requests';
  import { session } from '../lib/session.svelte';
  import ButtonIcon from '../components/ButtonIcon.svelte';
  import Marks from '../components/Marks.svelte';
  import Row from '../components/Row.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id, params }: { id: string; params: URLSearchParams } = $props();

  // Titles like this one, below its page; none is no row (and a server
  // before 0.6 has none).
  let similar = $state<TitleSummary[]>([]);
  $effect(() => {
    similar = [];
    similarOf(id).then((items) => (similar = items), () => {});
  });

  // The season a series shows: the one chosen here, else the one in the
  // address, else the first (specials last). Choosing one changes the
  // address without reloading the page.
  let chosen = $state<string | null>(null);
  function seasonOf(title: Title): string | null {
    if (title.kind !== 'series' || !title.seasons?.length) return null;
    return chosen ?? (title.seasons.find((s) => String(s.seasonNumber) === params.get('season')) ?? title.seasons[0]).id;
  }
  // A season chosen from the row: its episodes are brought into view once
  // they're there (its heading just under the header).
  let reveal = false;
  function choose(title: Title, s: TitleSummary) {
    chosen = s.id;
    reveal = true;
    history.replaceState(history.state, '', `${titlePathOf(title)}?season=${s.seasonNumber}`);
  }
  function revealed(node: HTMLElement) {
    if (!reveal) return;
    reveal = false;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => node.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }));
  }
  // The row of seasons is one stop for Tab (the chosen season); the arrows,
  // Home and End move along it, Enter or Space chooses.
  function seasonKeys(e: KeyboardEvent) {
    const tabs = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=tab]')];
    const at = tabs.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const to = e.key === 'ArrowRight' ? Math.min(at + 1, tabs.length - 1) : e.key === 'ArrowLeft' ? Math.max(at - 1, 0)
      : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    e.stopPropagation();
    tabs[to].focus();
    tabs[to].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // The row of seasons opens on the chosen one, without moving the page.
  function onChosen(row: HTMLElement) {
    const active = row.querySelector<HTMLElement>('[aria-selected="true"]');
    if (active) row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
  }

  // An episode marked from the list.
  let episodeMarks = $state<Record<string, boolean>>({});
  let episodeFavorites = $state<Record<string, boolean>>({});
  async function toggleEpisodeFavorite(e: TitleSummary) {
    homeChanged();
    const now = episodeFavorites[e.id] ?? e.userState?.favorite ?? false;
    try {
      episodeFavorites[e.id] = (await overfin.setFavorite(e.id, !now)).favorite;
    } catch (err) {
      await notice(explain(err));
    }
  }

  async function toggleEpisode(e: TitleSummary) {
    homeChanged();
    const now = episodeMarks[e.id] ?? e.userState?.played ?? false;
    try {
      episodeMarks[e.id] = (await overfin.setPlayed(e.id, !now)).played;
    } catch (err) {
      await notice(explain(err));
    }
  }

  // Requests: the one made or cancelled here replaces what was loaded; a
  // season's or an episode's reloads the season's episodes.
  let mainRequest = $state<TitleSummary['request'] | null | undefined>(undefined);
  // The cast: the first dozen in a row, everyone on demand.
  const castShown = 12;
  let wholeCast = $state(false);
  let seasonReload = $state(0);
  // Long texts fold, unless unfolded: the title's overview (four lines),
  // the season's (three) and episodes' descriptions (two); "Read more"
  // only on those that don't fit. By key: "title", a season's or an episode's ID.
  let unfolded = $state<Record<string, boolean>>({});
  let longAbout = $state<Record<string, boolean>>({});
  function overflows(node: HTMLElement, report: (long: boolean) => void) {
    const check = () => {
      if (node.classList.contains('folded')) report(node.scrollHeight > node.clientHeight + 1);
    };
    const watch = new ResizeObserver(check);
    watch.observe(node);
    check();
    return { destroy: () => watch.disconnect() };
  }
  const askable = (x: TitleSummary) => session.requests && !x.playable && x.availability !== 'available' && x.kind !== 'other';
  async function requestMain(x: Title) {
    const made = await ask(x);
    if (made) mainRequest = made;
  }
  async function cancelMain(id: string) {
    if (!(await confirm(t('request.cancelConfirm')))) return;
    try {
      await overfin.cancelRequest(id);
      homeChanged();
      mainRequest = null;
    } catch {
      mainRequest = undefined;
    }
  }
  async function requestPart(x: TitleSummary) {
    if (await ask(x)) seasonReload++;
  }
  const askLabel = (x: TitleSummary) => x.kind === 'series' ? t('request.askSeries')
    : x.kind === 'season' || x.kind === 'episode' ? t('request.askSeason', { number: x.seasonNumber ?? '?' }) : t('request.ask');
  const statusLabel = (r: NonNullable<TitleSummary['request']>) => t(`request.status.${r.status}` as Key);

  function availabilityText(x: TitleSummary): string {
    if (x.availability === 'missing') return t('title.notHere');
    if (x.availability === 'partiallyAvailable' && x.episodeCount) {
      return t('title.partly', { have: x.episodeCount.inLibrary, aired: x.episodeCount.aired });
    }
    return '';
  }
  const seasonName = (s: TitleSummary) => s.seasonNumber === 0 ? t('title.specials') : s.name || t('discover.seasonNumber', { number: s.seasonNumber ?? '?' });

  // Its address put right: the name, as the person sees it (lib/paths).
  // svelte-ignore state_referenced_locally
  titleOf(id).then((t) => correct(titlePathOf(t), (parts) => titleIdOf(parts) === id), () => {});
</script>

{#await titleOf(id)}
  <Skeleton kind="title" />
{:then title}
  {@const seasonID = seasonOf(title)}
  {@const request = mainRequest === undefined ? title.request : mainRequest}
  {@const position = title.userState?.positionMs ?? 0}
  {@const backdrop = title.images?.backdrops?.[0] ?? (title.kind === 'episode' ? title.images?.primary : undefined)}
  {@const poster = title.kind === 'episode' ? undefined : title.images?.primary}
  {@const seasonPoster = title.kind === 'episode' && title.season ? titleOf(title.season.id) : undefined}
  <!-- Its backdrop is the page's, fixed behind it (lib/backdrop). -->
  <div class="hero" class:art={!!backdrop} data-theme={backdrop ? 'dark' : undefined} use:backdropOf={backdrop ? { wide: overfin.imageUrl(backdrop, 'large'), tall: title.images?.textless ? overfin.imageUrl(title.images.textless, 'large') : undefined } : undefined}>
    <div class="info">
      {#if poster}
        <div class="poster">
          <img src={overfin.imageUrl(poster, 'medium')} alt="" use:loaded />
        </div>
      {:else if seasonPoster && title.season}
        <!-- An episode: its season's poster, leading back to it. -->
        {#await seasonPoster then s}
          {#if s.images?.primary}
            <a class="poster" href={titlePath(title.season.id, title.series?.name ?? s.name)} aria-label={s.name || seasonName(s)}>
              <img src={overfin.imageUrl(s.images.primary, 'medium')} alt="" use:loaded />
            </a>
          {/if}
        {:catch}{/await}
      {/if}
      <div>
        {#if title.series}
          <!-- Where it is: its series, and an episode's season. -->
          <nav class="breadcrumbs" aria-label={t('title.breadcrumbs')}>
            <ol>
              <li><a href={titlePath(title.series.id, title.series.name)}>{title.series.name}</a></li>
              {#if title.kind === 'episode' && title.season}
                <li><a href={titlePath(title.season.id, title.series.name)}>{title.season.name || seasonName(title)}</a></li>
                <li aria-current="page">{t('title.episodeNumber', { number: title.episodeNumber ?? '?' })}</li>
              {:else}
                <li aria-current="page">{seasonName(title)}</li>
              {/if}
            </ol>
          </nav>
        {/if}
        {#if title.images?.logo && title.kind !== 'episode' && title.kind !== 'season'}
          <h1 class="logo"><img src={overfin.imageUrl(title.images.logo, 'medium')} alt={title.name} /></h1>
        {:else}
          <h1>{title.name}</h1>
        {/if}
        <div class="meta">
          {#if title.airDate}<span>{new Date(title.airDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          {:else if title.year}<span>{title.year}</span>{/if}
          {#if ageText(title.age)}<span class="age">{ageText(title.age)}</span>{/if}
          {#if score(title)}{@const s = score(title)!}
            <span class="score" title={t('item.score', { value: s.value, votes: s.votes.toLocaleString() })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>{s.value}
              <span class="sr-only">{t('item.score', { value: s.value, votes: s.votes.toLocaleString() })}</span>
            </span>
          {/if}
          {#if title.durationMs && title.kind !== 'series'}<span>{duration(title.durationMs)}</span>{/if}
          {#if title.genres?.length}<span>{title.genres.join(', ')}</span>{/if}
          {#if availabilityText(title)}<span class="availability">{availabilityText(title)}</span>{/if}
        </div>
        {#if title.tagline}<p class="tagline">{title.tagline}</p>{/if}
        <div class="actions">
          {#if !title.playable && askable(title)}
            {#if request}
              <span class="request-status">{statusLabel(request)}</span>
              {#if request.status === 'pending' && request.id}
                <button onclick={() => cancelMain(request.id!)}>{t('request.cancel')}</button>
              {/if}
            {:else}
              <button class="primary" onclick={() => requestMain(title)}><ButtonIcon name="request" />{askLabel(title)}</button>
            {/if}
          {/if}
          {#if title.kind === 'series' && title.availability !== 'missing'}
            <!-- The episode playing the series plays: the one in progress,
                 the next one, or the first. -->
            {#await overfin.upNext(title.id) then up}
              {@const ep = t('item.seasonEpisodeShort', { season: up.title.seasonNumber ?? '?', episode: up.title.episodeNumber ?? '?' })}
              <button class="primary" onclick={() => play(up.title.id, up.positionMs)}>
                <ButtonIcon name="play" />{up.positionMs ? t('item.resumeEpisode', { episode: ep, time: clock(up.positionMs) }) : t('item.playEpisode', { episode: ep })}
              </button>
            {:catch}
              <!-- No episode to play: nothing offered. -->
            {/await}
          {/if}
          {#if title.playable}
            {#if position}
              <button class="primary" onclick={() => play(title.id, position)}><ButtonIcon name="play" />{t('item.resumeFrom', { time: clock(position) })}</button>
              <button onclick={() => play(title.id, 0)}><ButtonIcon name="restart" />{t('item.fromStart')}</button>
            {:else}
              <button class="primary" onclick={() => play(title.id, 0)}><ButtonIcon name="play" />{t('item.play')}</button>
            {/if}
          {/if}
          <!-- My list, watched, favorite: icons that fill in when on. -->
          <Marks id={title.id} played={title.userState?.played} favorite={title.userState?.favorite} />
          {#if title.collection}
            <a class="button toggle" href={collectionPath(title.collection.id, title.collection.name)} aria-label={t('title.seeCollection')} title={t('title.seeCollection')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="12" height="15" rx="1.5" /><path d="M4.5 7v12a1.5 1.5 0 0 0 1.5 1.5h10" /></svg>
            </a>
          {/if}
        </div>
        {#if title.overview}
          <p class="overview" id="title-overview" class:folded={!unfolded.title} use:overflows={(long) => (longAbout.title = long)}>{title.overview}</p>
          {#if longAbout.title || unfolded.title}
            <button class="link about-toggle" type="button" aria-expanded={!!unfolded.title} aria-controls="title-overview"
              onclick={() => (unfolded.title = !unfolded.title)}>
              {unfolded.title ? t('common.readLess') : t('common.readMore')}
            </button>
          {/if}
        {/if}
      </div>
    </div>
  </div>

  <!-- The rest scrolls up over the backdrop. -->
  <div class="sheet">

  {#if title.kind === 'series' && title.seasons && title.seasons.length > 1}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="seasons" role="tablist" aria-label={t('item.seasons')} use:onChosen onkeydown={seasonKeys}>
      {#each title.seasons as s (s.id)}
        {@const art = s.images?.primary ?? title.images?.primary}
        <button type="button" role="tab" aria-selected={seasonID === s.id} class:active={seasonID === s.id}
          tabindex={seasonID === s.id ? 0 : -1} aria-controls="season-episodes" onclick={() => choose(title, s)}>
          <span class="season-poster">
            {#if art}<img src={overfin.imageUrl(art, 'small')} alt="" loading="lazy" use:loaded />{/if}
            {#if !s.images?.primary}<span class="number">{s.seasonNumber === 0 ? t('title.specials') : s.seasonNumber}</span>{/if}
            {#if s.availability === 'missing'}<span class="flag">{t('title.notHere')}</span>
            {:else if s.availability === 'partiallyAvailable'}<span class="flag">{t('discover.partly')}</span>{/if}
          </span>
          <span class="season-name">{seasonName(s)}</span>
          {#if s.year}<span class="season-year">{s.year}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
  <!-- The chosen season's episodes: the seasons' tab panel. -->
  <div id="season-episodes" role={title.kind === 'series' && (title.seasons?.length ?? 0) > 1 ? 'tabpanel' : undefined}>
  {#key `${seasonID}:${seasonReload}`}
  {#await title.kind === 'season' && !seasonReload ? Promise.resolve(title) : title.kind === 'season' ? overfin.title(title.id)
    : seasonID ? (seasonReload ? overfin.title(seasonID) : titleOf(seasonID)) : Promise.resolve(null)}
    {#if title.kind === 'series'}<Skeleton kind="list" />{/if}
  {:then season}
  {#if season?.episodes?.length}
    {#if title.kind === 'series'}
      <div class="season-head" use:revealed>
        <h2>{seasonName(season)}{#if availabilityText(season)} <span class="muted small">· {availabilityText(season)}</span>{/if}</h2>
        {#if askable(season)}
          {#if season.request}
            <span class="request-status">{statusLabel(season.request)}</span>
          {:else}
            <button onclick={() => requestPart(season)}><ButtonIcon name="request" />{askLabel(season)}</button>
          {/if}
        {/if}
      </div>
    {:else}
      <h2>{t('item.episodes')}</h2>
    {/if}
    {#if season.overview && title.kind === 'series' && season.overview !== title.overview}
      <p class="muted season-overview" id="season-overview" class:folded={!unfolded[season.id]} use:overflows={(long) => (longAbout[season.id] = long)}>{season.overview}</p>
      {#if longAbout[season.id] || unfolded[season.id]}
        <button class="link about-toggle" type="button" aria-expanded={!!unfolded[season.id]} aria-controls="season-overview"
          onclick={() => (unfolded[season.id] = !unfolded[season.id])}>
          {unfolded[season.id] ? t('common.readLess') : t('common.readMore')}
        </button>
      {/if}
    {/if}
    <ol class="episodes">
      {#each season.episodes as e (e.id)}
        {@const seen = episodeMarks[e.id] ?? e.userState?.played ?? false}
        {@const at = e.userState?.positionMs ?? 0}
        {@const loved = episodeFavorites[e.id] ?? e.userState?.favorite ?? false}
        <li class:missing={e.availability === 'missing'}>
          <div class="still">
            {#if e.images?.primary}
              <img src={overfin.imageUrl(e.images.primary, 'medium')} alt="" loading="lazy" use:loaded />
            {/if}
            {#if at && e.durationMs}<div class="progress" style:width="{Math.min(100, (100 * at) / e.durationMs)}%"></div>{/if}
            {#if e.playable}
              <button class="act" type="button" aria-label={t('item.play') + ' : ' + e.name} onclick={() => play(e.id, at)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </button>
            {:else if askable(e) && !e.request}
              <button class="act ask" type="button" aria-label={askLabel(e)} title={askLabel(e)} onclick={() => requestPart(e)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v8.2l3.1-3.1 1.4 1.4L12 16l-5.5-5.5 1.4-1.4L11 12.2zM5 18h14v2H5z" /></svg>
              </button>
            {/if}
          </div>
          <div class="head">
            <a href={titlePathOf(e)}><span class="number">{e.episodeNumber}.</span> {e.name}</a>
            <!-- Watched and favorite, as on a title's page. -->
            <div class="marks actions">
              <button class="toggle" class:on={seen} type="button" aria-pressed={seen}
                aria-label={seen ? t('item.markUnwatched') : t('item.markWatched')} title={seen ? t('item.markUnwatched') : t('item.markWatched')}
                onclick={() => toggleEpisode(e)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path class="mark" d="M7.8 12.3l2.8 2.8 5.6-5.8" /></svg>
              </button>
              <button class="toggle heart" class:on={loved} type="button" aria-pressed={loved}
                aria-label={loved ? t('item.favoriteRemove') : t('item.favoriteAdd')} title={loved ? t('item.favoriteRemove') : t('item.favoriteAdd')}
                onclick={() => toggleEpisodeFavorite(e)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3l-1.3-1.2C5.9 14.8 3 12.2 3 8.9 3 6.3 5 4.3 7.6 4.3c1.6 0 3.2.8 4.4 2 1.2-1.2 2.8-2 4.4-2 2.6 0 4.6 2 4.6 4.6 0 3.3-2.9 5.9-7.7 10.2z" /></svg>
              </button>
            </div>
          </div>
          <div class="muted small">
            {#if e.airDate}{new Date(e.airDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}{/if}
            {#if e.durationMs} · {duration(e.durationMs)}{/if}
            {#if e.request && e.availability !== 'available'} · {statusLabel(e.request)}
            {:else if e.availability === 'missing'} · {t('title.notHere')}{/if}
          </div>
          {#if e.overview}
            <p class="about" class:folded={!unfolded[e.id]} use:overflows={(long) => (longAbout[e.id] = long)}>{e.overview}</p>
            {#if longAbout[e.id] || unfolded[e.id]}
              <button class="link about-toggle" type="button" aria-expanded={!!unfolded[e.id]}
                onclick={() => (unfolded[e.id] = !unfolded[e.id])}>
                {unfolded[e.id] ? t('common.readLess') : t('common.readMore')}
              </button>
            {/if}
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
  {:catch error}
    <PageError {error} />
  {/await}
  {/key}
  </div>

  {#if title.cast?.length}
    {@const cast = wholeCast ? title.cast : title.cast.slice(0, castShown)}
    <div class="section-head">
      <h2>{t('item.cast')}</h2>
      {#if title.cast.length > castShown}
        <button class="link" type="button" aria-expanded={wholeCast} onclick={() => (wholeCast = !wholeCast)}>
          {wholeCast ? t('item.castLess') : t('item.castAll', { count: title.cast.length })}
        </button>
      {/if}
    </div>
    <div class={wholeCast ? 'grid' : 'row'}>
      {#each cast as c, i (i)}
        <svelte:element this={c.id ? 'a' : 'div'} class="card person" href={c.id ? personPath(c.id, c.name) : undefined}>
          <div class="poster round">
            {#if c.image}
              <img src={overfin.imageUrl(c.image, 'small')} alt="" loading="lazy" use:loaded />
            {:else}
              <div class="fallback initials">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            {/if}
          </div>
          <div class="title">{c.name}</div>
          <div class="sub">{c.character ?? ''}</div>
        </svelte:element>
      {/each}
    </div>
  {/if}
  <Row title={t('item.similar')} items={similar} />
  </div>
{:catch error}
  <PageError {error} />
{/await}
