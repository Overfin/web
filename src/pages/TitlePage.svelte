<!-- A title, in a library or not: a film, a series, a season or an episode.
     Everything about it (text, images, cast) is TMDB's; the library only
     decides whether it plays. A series shows its seasons as tabs, with the
     chosen season's episodes, those no library has too. -->
<script lang="ts">
  import type { Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { clock, duration } from '../lib/format';
  import { t, tn, type Key } from '../lib/i18n.svelte';
  import { confirm } from '../lib/dialog.svelte';
  import { play } from '../lib/play';
  import { ask } from '../lib/requests';
  import { session } from '../lib/session.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import TMDBNotice from '../components/TMDBNotice.svelte';

  let { id, params }: { id: string; params: URLSearchParams } = $props();

  // The season a series shows: the one chosen here, else the one in the
  // address, else the first (specials last). Choosing one changes the
  // address without reloading the page.
  let chosen = $state<string | null>(null);
  function seasonOf(title: Title): string | null {
    if (title.kind !== 'series' || !title.seasons?.length) return null;
    return chosen ?? (title.seasons.find((s) => String(s.seasonNumber) === params.get('season')) ?? title.seasons[0]).id;
  }
  function choose(title: Title, s: TitleSummary) {
    chosen = s.id;
    history.replaceState(history.state, '', `/title/${title.id}?season=${s.seasonNumber}`);
  }

  let onList = $state<boolean | null>(null);
  $effect(() => {
    onList = null;
    overfin.onWatchlist(id).then((on) => (onList = on)).catch(() => {}); // not offered here
  });
  async function toggleList() {
    onList = !onList;
    await (onList ? overfin.addToWatchlist(id) : overfin.removeFromWatchlist(id));
  }

  // Watched and favorite, as the profile marks them: what the server says
  // back replaces what the page loaded.
  let marks = $state<{ played?: boolean; favorite?: boolean }>({});
  async function togglePlayed(now: boolean) {
    marks.played = (await overfin.setPlayed(id, !now)).played;
  }
  async function toggleFavorite(now: boolean) {
    marks.favorite = (await overfin.setFavorite(id, !now)).favorite;
  }
  // An episode marked from the list.
  let episodeMarks = $state<Record<string, boolean>>({});
  async function toggleEpisode(e: TitleSummary) {
    const now = episodeMarks[e.id] ?? e.userState?.played ?? false;
    episodeMarks[e.id] = (await overfin.setPlayed(e.id, !now)).played;
  }

  // Requests: the one made or cancelled here replaces what was loaded; a
  // season's or an episode's reloads the season's episodes.
  let mainRequest = $state<TitleSummary['request'] | null | undefined>(undefined);
  // The cast: the first dozen in a row, everyone on demand.
  const castShown = 12;
  let wholeCast = $state(false);
  let seasonReload = $state(0);
  const askable = (x: TitleSummary) => session.requests && !x.playable && x.availability !== 'available' && x.kind !== 'other';
  async function requestMain(x: Title) {
    const made = await ask(x.id);
    if (made) mainRequest = made;
  }
  async function cancelMain(id: string) {
    if (!(await confirm(t('request.cancelConfirm')))) return;
    try {
      await overfin.cancelRequest(id);
      mainRequest = null;
    } catch {
      mainRequest = undefined;
    }
  }
  async function requestPart(x: TitleSummary) {
    if (await ask(x.id)) seasonReload++;
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
</script>

{#await overfin.title(id)}
  <Skeleton kind="title" />
{:then title}
  {@const seasonID = seasonOf(title)}
  {@const request = mainRequest === undefined ? title.request : mainRequest}
  {@const position = title.userState?.positionMs ?? 0}
  {@const played = marks.played ?? title.userState?.played ?? false}
  {@const favorite = marks.favorite ?? title.userState?.favorite ?? false}
  {@const backdrop = title.images?.backdrops?.[0] ?? (title.kind === 'episode' ? title.images?.primary : undefined)}
  {@const poster = title.kind === 'episode' ? undefined : title.images?.primary}
  <div class="hero" class:art={!!backdrop}>
    {#if backdrop}
      <img class="backdrop" src={overfin.imageUrl(backdrop, 'large')} alt="" use:loaded />
    {/if}
    <div class="info">
      {#if poster}
        <div class="poster">
          <img src={overfin.imageUrl(poster, 'medium')} alt="" use:loaded />
        </div>
      {/if}
      <div>
        {#if title.series}
          <p class="parent"><a href="/title/{title.series.id}">{title.series.name}</a>
            {#if title.kind === 'episode'}· {t('item.seasonEpisode', { season: title.seasonNumber ?? '?', episode: title.episodeNumber ?? '?' })}{/if}
          </p>
        {/if}
        {#if title.images?.logo && title.kind !== 'episode' && title.kind !== 'season'}
          <h1 class="logo"><img src={overfin.imageUrl(title.images.logo, 'medium')} alt={title.name} /></h1>
        {:else}
          <h1>{title.name}</h1>
        {/if}
        <div class="meta">
          {#if title.airDate}<span>{new Date(title.airDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          {:else if title.year}<span>{title.year}</span>{/if}
          {#if title.certification}<span class="certification">{title.certification}</span>{/if}
          {#if title.durationMs && title.kind !== 'series'}<span>{duration(title.durationMs)}</span>{/if}
          {#if title.genres?.length}<span>{title.genres.join(', ')}</span>{/if}
          {#if availabilityText(title)}<span class="availability">{availabilityText(title)}</span>{/if}
        </div>
        {#if title.tagline}<p class="tagline">{title.tagline}</p>{/if}
        <div class="actions">
          {#if !title.playable && askable(title)}
            {#if request}
              <span class="request-status">{statusLabel(request)}</span>
              {#if request.status === 'pending'}
                <button onclick={() => cancelMain(request.id)}>{t('request.cancel')}</button>
              {/if}
            {:else}
              <button class="primary" onclick={() => requestMain(title)}>{askLabel(title)}</button>
            {/if}
          {/if}
          {#if title.playable}
            {#if position}
              <button class="primary" onclick={() => play(title.id, position)}>{t('item.resumeFrom', { time: clock(position) })}</button>
              <button onclick={() => play(title.id, 0)}>{t('item.fromStart')}</button>
            {:else}
              <button class="primary" onclick={() => play(title.id, 0)}>{t('item.play')}</button>
            {/if}
          {/if}
          {#if onList !== null}
            <button onclick={toggleList}>{onList ? t('item.watchlistOn') : t('item.watchlistAdd')}</button>
          {/if}
          <button onclick={() => togglePlayed(played)}>{played ? t('item.markUnwatched') : t('item.markWatched')}</button>
          <button onclick={() => toggleFavorite(favorite)}>{favorite ? t('item.favoriteOn') : t('item.favoriteAdd')}</button>
        </div>
        {#if title.overview}<p class="overview">{title.overview}</p>{/if}
      </div>
    </div>
  </div>

  {#if title.kind === 'series' && title.seasons && title.seasons.length > 1}
    <div class="seasons" role="tablist" aria-label={t('item.seasons')}>
      {#each title.seasons as s (s.id)}
        <button type="button" role="tab" aria-selected={seasonID === s.id} class:active={seasonID === s.id}
          onclick={() => choose(title, s)}>
          {seasonName(s)}
          {#if s.availability !== 'available'}<span class="dot" class:missing={s.availability === 'missing'}></span>{/if}
        </button>
      {/each}
    </div>
  {/if}
  {#key `${seasonID}:${seasonReload}`}
  {#await title.kind === 'season' && !seasonReload ? Promise.resolve(title) : title.kind === 'season' ? overfin.title(title.id)
    : seasonID ? overfin.title(seasonID) : Promise.resolve(null)}
    {#if title.kind === 'series'}<Skeleton kind="list" />{/if}
  {:then season}
  {#if season?.episodes?.length}
    {#if title.kind === 'series'}
      <div class="season-head">
        <h2>{seasonName(season)}{#if availabilityText(season)} <span class="muted small">· {availabilityText(season)}</span>{/if}</h2>
        {#if askable(season)}
          {#if season.request}
            <span class="request-status">{statusLabel(season.request)}</span>
          {:else}
            <button onclick={() => requestPart(season)}>{askLabel(season)}</button>
          {/if}
        {/if}
      </div>
    {:else}
      <h2>{t('item.episodes')}</h2>
    {/if}
    {#if season.overview && title.kind === 'series' && season.overview !== title.overview}<p class="muted season-overview">{season.overview}</p>{/if}
    <ol class="episodes">
      {#each season.episodes as e (e.id)}
        {@const seen = episodeMarks[e.id] ?? e.userState?.played ?? false}
        {@const at = e.userState?.positionMs ?? 0}
        <li class:missing={e.availability === 'missing'}>
          <div class="still">
            {#if e.images?.primary}
              <img src={overfin.imageUrl(e.images.primary, 'small')} alt="" loading="lazy" use:loaded />
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
          <div class="text">
            <a href="/title/{e.id}"><span class="number">{e.episodeNumber}.</span> {e.name}</a>
            <div class="muted small">
              {#if e.airDate}{new Date(e.airDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}{/if}
              {#if e.durationMs} · {duration(e.durationMs)}{/if}
              {#if e.request && e.availability !== 'available'} · {statusLabel(e.request)}
              {:else if e.availability === 'missing'} · {t('title.notHere')}{/if}
            </div>
          </div>
          <button class="seen-toggle" class:on={seen} type="button" aria-pressed={seen}
            aria-label={seen ? t('item.markUnwatched') : t('item.markWatched')} title={seen ? t('item.markUnwatched') : t('item.markWatched')}
            onclick={() => toggleEpisode(e)}>✓</button>
        </li>
      {/each}
    </ol>
  {/if}
  {:catch error}
    <PageError {error} />
  {/await}
  {/key}

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
        <div class="card">
          <div class="poster">
            {#if c.image}
              <img src={overfin.imageUrl(c.image, 'small')} alt="" loading="lazy" use:loaded />
            {:else}
              <div class="fallback initials">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            {/if}
          </div>
          <div class="title">{c.name}</div>
          <div class="sub">{c.character ?? ''}</div>
        </div>
      {/each}
    </div>
  {/if}
  <TMDBNotice />
{:catch error}
  <PageError {error} />
{/await}
