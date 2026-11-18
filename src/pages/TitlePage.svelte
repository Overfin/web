<!-- A title, in a library or not: a film, a series, a season or an episode.
     Everything about it (text, images, cast) is TMDB's; the library only
     decides whether it plays. A series shows its seasons as a row of
     posters, with the chosen season's episodes, those no library has too;
     an episode shows its season's poster. -->
<script lang="ts">
  import { tick } from 'svelte';
  import { leavingText } from '../lib/leaving';
  import { homeChanged } from '../lib/homecache';
  import { screenWidth, sized, sizes, srcset } from '../lib/images';
  import { prefetchTitle, similarOf, titleOf } from '../lib/titlecache';
  import type { Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { explain, overfin } from '../lib/client';
  import { loaded } from '../lib/loaded';
  import { backdropOf } from '../lib/backdrop.svelte';
  import { collectionPath, correct, personPath, titleIdOf, titlePath, titlePathOf } from '../lib/paths';
  import { ageText, clock, duration, pictureText, shortList, trackLabel } from '../lib/format';
  import { date, listParts, num, t, timeOfDay, tn, type Key } from '../lib/i18n.svelte';
  import { notice } from '../lib/dialog.svelte';
  import { play } from '../lib/play';
  import { score } from '../lib/score';
  import { loadWishes, seriesWished, toggleSeries, toggleWish, wishable, wishes } from '../lib/wishlist.svelte';
  import { session } from '../lib/session.svelte';
  import ButtonIcon from '../components/ButtonIcon.svelte';
  import Marks from '../components/Marks.svelte';
  import Row from '../components/Row.svelte';
  import Card from '../components/Card.svelte';
  import ScrollRow from '../components/ScrollRow.svelte';
  import { HelpTip } from '@overfin/ui';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { id, params }: { id: string; params: URLSearchParams } = $props();

  // A season's address opens its series' page, that season chosen and
  // brought into view: seasons have no page of their own.
  const seasonRoute = $derived(/^(title_series_.+)_s(\d{1,4})$/.exec(id));
  const pageId = $derived(seasonRoute ? seasonRoute[1] : id);

  // Titles like this one, below its page; none is no row (and a server
  // before 0.6 has none).
  let similar = $state<TitleSummary[]>([]);
  $effect(() => {
    similar = [];
    // By the title's whole ID (an episode's address may name it alone).
    titleOf(pageId).then((t) => similarOf(t.id)).then((items) => (similar = items), () => {});
  });

  // The season a series shows: the one chosen here, else the one in the
  // address, else the first (specials last). Choosing one changes the
  // address without reloading the page.
  let chosen = $state<string | null>(null);
  function seasonOf(title: Title): string | null {
    if (title.kind !== 'series' || !title.seasons?.length) return null;
    const asked = params.get('season') ?? seasonRoute?.[2];
    return chosen ?? (title.seasons.find((s) => String(s.seasonNumber) === asked) ?? title.seasons[0]).id;
  }
  // A season chosen from the row, or asked by its address: its episodes
  // are brought into view once they're there (its heading just under the
  // header).
  // svelte-ignore state_referenced_locally
  let reveal = !!seasonRoute;
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

  // Every place the title is available, listed whole on demand.
  let allSources = $state(false);
  $effect(() => {
    void pageId;
    allSources = false;
  });
  // The button pressed goes; focus stays on the one taking its place.
  async function showSources(all: boolean) {
    allSources = all;
    await tick();
    document.querySelector<HTMLElement>('#title-sources .sources-more')?.focus();
  }

  // An episode marked from the list.
  let episodeMarks = $state<Record<string, boolean>>({});
  // "Not interested" taken back here: shown at once (the title kept in the
  // cache changes too, for the next visit).
  let wantedAgain = $state<Record<string, boolean>>({});
  async function interestedAgain(title: Title) {
    wantedAgain[title.id] = true;
    try {
      await overfin.setNotInterested(title.id, false);
      title.notInterested = false;
      homeChanged();
    } catch (err) {
      wantedAgain[title.id] = false;
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

  // The cast: the first dozen in a row, everyone on demand.
  const castShown = 12;
  let wholeCast = $state(false);
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
  // Wishes: films, seasons, and a series as its seasons (never episodes).
  // The wish button leads only when nothing of the title is here.
  loadWishes();
  const wishLabel = (x: TitleSummary) => wishes.ids[x.id] ? t('wish.on')
    : x.kind === 'season' ? t('wish.addSeason', { number: x.seasonNumber ?? '?' }) : t('wish.add');

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
  titleOf(pageId).then((t) => {
    // A season's address becomes its series' with the season: only while
    // the address still shows this page (it may have been left meanwhile).
    if (seasonRoute) correct(titlePathOf(t), (parts) => titleIdOf(parts) === id, `?season=${seasonRoute[2]}`);
    else correct(titlePathOf(t), (parts) => titleIdOf(parts) === id);
  }, () => {});

  // When an episode would end, started (or resumed) now: kept current.
  let now = $state(Date.now());
  $effect(() => {
    const tick = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(tick);
  });
  // The episode's season, for its other episodes, the one before and after.
  function neighbours(list: TitleSummary[] | undefined, current: string) {
    const i = (list ?? []).findIndex((e) => e.id === current);
    return { previous: i > 0 ? list![i - 1] : undefined, next: i >= 0 && i + 1 < list!.length ? list![i + 1] : undefined };
  }
  // The episodes before and after, read ahead (their page and pictures):
  // going to them shows them at once.
  function readAhead(_node: HTMLElement, ids: (string | undefined)[]) {
    for (const id of ids) if (id) prefetchTitle(id);
  }
  // The season's row opens on the current episode, without moving the page.
  function onCurrent(row: HTMLElement) {
    const current = row.querySelector<HTMLElement>('.current');
    if (current) row.scrollLeft = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
  }
</script>

{#await titleOf(pageId)}
  <Skeleton kind="title" />
{:then title}
  {@const seasonID = seasonOf(title)}
  {@const position = title.userState?.positionMs ?? 0}
  {@const backdrop = title.images?.backdrops?.[0] ?? (title.kind === 'episode' ? title.images?.primary : undefined)}
  {@const poster = title.kind === 'episode' ? undefined : title.images?.primary}
  {@const still = title.kind === 'episode' ? title.images?.primary : undefined}
  {@const seriesPath = title.series ? titlePath(title.series.id, title.series.name) + (title.seasonNumber !== undefined ? `?season=${title.seasonNumber}` : '') : ''}
  <!-- Its backdrop is the page's, fixed behind it (lib/backdrop). -->
  <div class="hero title-hero" class:art={!!backdrop} data-theme={backdrop ? 'dark' : undefined} use:backdropOf={backdrop ? { wide: sized(backdrop, 'backdrop', screenWidth()), tall: title.images?.textless ? sized(title.images.textless, 'poster', screenWidth()) : undefined, even: true } : undefined}>
    <div class="info">
      {#if poster}
        <div class="poster">
          <img src={overfin.imageUrl(poster, 'medium')} srcset={srcset(poster, 'poster')} sizes={sizes.heroPoster} alt="" use:loaded />
        </div>
      {:else if still}
        <!-- An episode: its own picture, wide. -->
        <div class="poster still-hero">
          <img src={overfin.imageUrl(still, 'medium')} srcset={srcset(still, 'still')} sizes={sizes.heroStill} alt="" use:loaded />
        </div>
      {/if}
      <div>
        {#if title.series}
          <!-- An episode's series, back to its page, this season chosen. -->
          <a class="series-link" href={seriesPath}>
            {#if title.images?.logo}
              <img src={overfin.imageUrl(title.images.logo, 'medium')} srcset={srcset(title.images.logo, 'logo')} sizes={sizes.logo} alt={title.series.name} />
            {:else}{title.series.name}{/if}
          </a>
        {/if}
        {#if title.images?.logo && title.kind !== 'episode' && title.kind !== 'season'}
          <h1 class="logo"><img src={overfin.imageUrl(title.images.logo, 'medium')} srcset={srcset(title.images.logo, 'logo')} sizes={sizes.logo} alt={title.name} /></h1>
        {:else}
          <h1>{title.name}</h1>
        {/if}
        <div class="meta">
          {#if title.kind === 'episode' && title.seasonNumber !== undefined && title.episodeNumber !== undefined}
            <span>{t('item.seasonEpisodeShort', { season: title.seasonNumber, episode: title.episodeNumber })}</span>
          {/if}
          {#if title.airDate}<span>{date(title.airDate)}</span>
          {:else if title.year}<span>{title.year}</span>{/if}
          {#if ageText(title.age)}<span class="age">{ageText(title.age)}</span>{/if}
          {#if score(title)}{@const s = score(title)!}
            <span class="score" title={t('item.score', { value: s.value, votes: num(s.votes) })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>{s.value}
              <span class="sr-only">{t('item.score', { value: s.value, votes: num(s.votes) })}</span>
            </span>
          {/if}
          {#if title.rank && (title.kind === 'movie' || title.kind === 'series')}
            <span class="rank">#{num(title.rank)}<HelpTip text={t(title.kind === 'series' ? 'title.rank.series' : 'title.rank.movie')} /></span>
          {/if}
          {#if title.durationMs && title.kind !== 'series'}<span>{duration(title.durationMs)}</span>{/if}
          {#if title.kind === 'episode' && title.playable && title.durationMs}
            <span>{t('title.endsAt', { time: timeOfDay(new Date(now + title.durationMs - position)) })}</span>
          {/if}
          {#if title.genres?.length}<span>{title.genres.join(', ')}</span>{/if}
          {#if availabilityText(title)}<span class="availability">{availabilityText(title)}</span>{/if}
          {#if leavingText(title.leavesAt, title.kind)}<span class="leaving">{leavingText(title.leavesAt, title.kind)}</span>{/if}
        </div>
        {#if title.tagline}<p class="tagline">{title.tagline}</p>{/if}
        <div class="actions">
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
          <!-- My list, watched, favorite: icons that fill in when on (no
               heart on an episode: favorites are films and series). -->
          <Marks id={title.id} played={title.userState?.played} favorite={title.userState?.favorite} heart={title.kind !== 'episode'} />
          {#if title.collection}
            <a class="button toggle" href={collectionPath(title.collection.id, title.collection.name)} aria-label={t('title.seeCollection')} title={t('title.seeCollection')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3.5" width="12" height="15" rx="1.5" /><path d="M4.5 7v12a1.5 1.5 0 0 0 1.5 1.5h10" /></svg>
            </a>
          {/if}
          {#if title.kind === 'series' && wishable(title, title.seasons)}
            <!-- A series is wished for season by season: its seasons out
                 now that aren't here whole. After Play and the marks:
                 first only when nothing is here. -->
            {@const on = seriesWished(title.seasons ?? [])}
            <button class:primary={!on && title.availability === 'missing'} aria-pressed={on} onclick={() => toggleSeries(title, title.seasons ?? [])}>
              <ButtonIcon name={on ? 'wished' : 'wish'} />{on ? t('wish.on') : t('wish.addSeries')}
            </button>
          {:else if title.kind !== 'series' && wishable(title)}
            <button class:primary={!wishes.ids[title.id] && title.availability === 'missing'} aria-pressed={!!wishes.ids[title.id]} onclick={() => toggleWish(title)}>
              <ButtonIcon name={wishes.ids[title.id] ? 'wished' : 'wish'} />{wishLabel(title)}
            </button>
          {/if}
        </div>
        {#if title.notInterested && !wantedAgain[title.id]}
          <p class="not-interested">{t('title.notInterested')}
            · <button class="link" type="button" onclick={() => interestedAgain(title)}>{t('title.interestedAgain')}</button></p>
        {/if}
        {#if title.overview}
          <p class="overview" id="title-overview" class:folded={!unfolded.title} use:overflows={(long) => (longAbout.title = long)}>{title.overview}</p>
          {#if longAbout.title || unfolded.title}
            <button class="link about-toggle" type="button" aria-expanded={!!unfolded.title} aria-controls="title-overview"
              onclick={() => (unfolded.title = !unfolded.title)}>
              {unfolded.title ? t('common.readLess') : t('common.readMore')}
            </button>
          {/if}
        {/if}
        {#if title.crew?.length}
          <!-- Who directed and wrote the episode. -->
          <dl class="facts">
            {#each [['Director', 'title.director'], ['Writer', 'title.writer']] as const as [job, key] (job)}
              {@const people = title.crew.filter((c) => c.character === job)}
              {#if people.length}
                <div><dt>{t(key)}</dt><dd>{#each people as c, i (i)}{#if i}, {/if}{#if c.id}<a href={personPath(c.id, c.name)}>{c.name}</a>{:else}{c.name}{/if}{/each}</dd></div>
              {/if}
            {/each}
          </dl>
        {/if}
        {#snippet where()}
          <!-- Where it plays from, Play's first: this server, then the
               servers it's shared from, by name. -->
          {#if title.showAvailability && title.sources?.length}
            {@const all = title.sources.map((s) => s.name ?? '')}
            {@const short = shortList(all)}
            {@const shown = allSources ? all : short.names}
            <div><dt>{t('title.availability')}</dt><dd id="title-sources">
              {#each listParts(short.more && !allSources ? [...shown, '…'] : shown) as part, i (i)}
                {#if 'text' in part}{part.text}{:else if part.item < shown.length}{shown[part.item]}{:else}<button class="link sources-more"
                  type="button" aria-expanded="false" aria-controls="title-sources" aria-label={tn('title.moreSourcesLabel', short.more)}
                  onclick={() => showSources(true)}>{tn('title.moreSources', short.more)}</button>{/if}
              {/each}
              {#if allSources && short.more}<button class="link sources-more fewer" type="button" aria-expanded="true" aria-controls="title-sources"
                onclick={() => showSources(false)}>{t('title.fewerSources')}</button>{/if}
            </dd></div>
          {/if}
        {/snippet}
        {#if title.sources?.[0] && !title.sources[0].local}
          {@const first = title.sources[0]}
          <!-- Played from another server: what it said of its copies. -->
          <dl class="facts copy">
            {@render where()}
            {#if first.video}<div><dt>{t('title.video')}</dt><dd>{pictureText(first.video)}</dd></div>{/if}
            {#if first.audio?.length}<div><dt>{t('title.audio')}</dt><dd>{first.audio.map(trackLabel).join(', ')}</dd></div>{/if}
            {#if first.subtitles?.length}<div><dt>{t('title.subtitles')}</dt><dd>{first.subtitles.map(trackLabel).join(', ')}</dd></div>{/if}
          </dl>
        {:else if title.copies?.length}
          <!-- What the files are: as the player shows them, nothing to choose. -->
          {#each title.copies as c, i (i)}
            <dl class="facts copy">
              {#if i === 0}{@render where()}{/if}
              {#if c.video}<div><dt>{t('title.video')}</dt><dd>{c.video}</dd></div>{/if}
              {#if c.audio?.length}<div><dt>{t('title.audio')}</dt><dd>{c.audio.map(trackLabel).join(', ')}</dd></div>{/if}
              {#if c.subtitles?.length}<div><dt>{t('title.subtitles')}</dt><dd>{c.subtitles.map(trackLabel).join(', ')}</dd></div>{/if}
            </dl>
          {/each}
        {:else if title.showAvailability && title.sources?.length}
          <dl class="facts copy">{@render where()}</dl>
        {/if}
      </div>
    </div>
  </div>

  <!-- The rest scrolls up over the backdrop. -->
  <!-- Over a backdrop, the page's veil is the sheet: nothing more. -->
  <div class="sheet" class:clear={!!backdrop} data-theme={backdrop ? 'dark' : undefined}>

  {#if title.kind === 'series' && title.seasons && title.seasons.length > 1}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <ScrollRow class="seasons" role="tablist" aria-label={t('item.seasons')} onrow={onChosen} onkeydown={seasonKeys}>
      {#each title.seasons as s (s.id)}
        {@const art = s.images?.primary ?? title.images?.primary}
        <button type="button" role="tab" aria-selected={seasonID === s.id} class:active={seasonID === s.id}
          tabindex={seasonID === s.id ? 0 : -1} aria-controls="season-episodes" onclick={() => choose(title, s)}>
          <span class="season-poster">
            {#if art}<img src={overfin.imageUrl(art, 'small')} srcset={srcset(art, 'poster')} sizes={sizes.card} alt="" loading="lazy" use:loaded />{/if}
            {#if !s.images?.primary}<span class="number">{s.seasonNumber === 0 ? t('title.specials') : s.seasonNumber}</span>{/if}
            {#if s.availability === 'missing'}<span class="flag">{t('title.notHere')}</span>
            {:else if s.availability === 'partiallyAvailable'}<span class="flag">{t('discover.partly')}</span>{/if}
          </span>
          <span class="season-name">{seasonName(s)}</span>
          {#if s.year}<span class="season-year">{s.year}</span>{/if}
        </button>
      {/each}
    </ScrollRow>
  {/if}
  <!-- The chosen season's episodes: the seasons' tab panel. -->
  <div id="season-episodes" role={title.kind === 'series' && (title.seasons?.length ?? 0) > 1 ? 'tabpanel' : undefined}>
  {#key seasonID}
  {#await title.kind === 'season' ? Promise.resolve(title) : seasonID ? titleOf(seasonID) : Promise.resolve(null)}
    {#if title.kind === 'series'}<Skeleton kind="list" />{/if}
  {:then season}
  {#if season?.episodes?.length}
    {#if title.kind === 'series'}
      <div class="season-head" use:revealed>
        <h2>{seasonName(season)}{#if availabilityText(season)} <span class="muted small">· {availabilityText(season)}</span>{/if}</h2>
        {#if wishable(season)}
          <button aria-pressed={!!wishes.ids[season.id]} onclick={() => toggleWish(season)}>
            <ButtonIcon name={wishes.ids[season.id] ? 'wished' : 'wish'} />{wishLabel(season)}
          </button>
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
        <li class:missing={e.availability === 'missing'}>
          <div class="still">
            {#if e.images?.primary}
              <img src={overfin.imageUrl(e.images.primary, 'medium')} srcset={srcset(e.images.primary, 'still')} sizes={sizes.episode} alt="" loading="lazy" use:loaded />
            {/if}
            {#if at && e.durationMs}<div class="progress" style:width="{Math.min(100, (100 * at) / e.durationMs)}%"></div>{/if}
            {#if e.playable}
              <button class="act" type="button" aria-label={t('item.play') + ' : ' + e.name} onclick={() => play(e.id, at)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </button>
            {/if}
          </div>
          <div class="head">
            <!-- One stop per episode for the arrows (lib/spatial): its play
                 button, else its name; the rest is Tab's. -->
            <a href={titlePathOf(e)} data-arrows={e.playable ? 'skip' : undefined}><span class="number">{e.episodeNumber}{#if e.episodeEnd}–{e.episodeEnd}{/if}.</span> {e.name}</a>
            <!-- Watched, as on a title's page (no heart: favorites are films
                 and series). -->
            <div class="marks actions" data-arrows="skip">
              <button class="toggle" class:on={seen} type="button" aria-pressed={seen}
                aria-label={seen ? t('item.markUnwatched') : t('item.markWatched')} title={seen ? t('item.markUnwatched') : t('item.markWatched')}
                onclick={() => toggleEpisode(e)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path class="mark" d="M7.8 12.3l2.8 2.8 5.6-5.8" /></svg>
              </button>
            </div>
          </div>
          <div class="muted small">
            {#if e.airDate}{date(e.airDate)}{/if}
            {#if e.durationMs} · {duration(e.durationMs)}{/if}
            {#if e.availability === 'missing'}<span class="chip unavailable">{t('title.unavailable')}</span>{/if}
          </div>
          {#if e.parts?.length}
            <!-- A file holding several episodes: each one's title, then
                 what it's about. -->
            <div class="about" class:folded={!unfolded[e.id]} use:overflows={(long) => (longAbout[e.id] = long)}>
              {#each e.parts as part, i (i)}<p><strong>{part.name}</strong>{#if part.overview}<br />{part.overview}{/if}</p>{/each}
            </div>
            {#if longAbout[e.id] || unfolded[e.id]}
              <button class="link about-toggle" type="button" data-arrows="skip" aria-expanded={!!unfolded[e.id]}
                onclick={() => (unfolded[e.id] = !unfolded[e.id])}>
                {unfolded[e.id] ? t('common.readLess') : t('common.readMore')}
              </button>
            {/if}
          {:else if e.overview}
            <p class="about" class:folded={!unfolded[e.id]} use:overflows={(long) => (longAbout[e.id] = long)}>{e.overview}</p>
            {#if longAbout[e.id] || unfolded[e.id]}
              <button class="link about-toggle" type="button" data-arrows="skip" aria-expanded={!!unfolded[e.id]}
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

  {#if title.kind === 'episode' && title.season}
    <!-- The episode's season: the one before and after, and all of them,
         this one marked. -->
    {#await titleOf(title.season.id) then season}
      {@const near = neighbours(season.episodes, title.id)}
      {#if season.episodes?.length}
        <div class="section-head" use:readAhead={[near.previous?.id, near.next?.id]}>
          <h2><a href={seriesPath}>{seasonName(season)}</a></h2>
          <span class="actions-row">
            {#if near.previous}<a class="button" href={titlePathOf(near.previous)}>‹ {t('title.previousEpisode')}</a>{/if}
            {#if near.next}<a class="button" href={titlePathOf(near.next)}>{t('title.nextEpisode')} ›</a>{/if}
          </span>
        </div>
        <ScrollRow onrow={onCurrent}>
          {#each season.episodes as e (e.id)}
            <div class="ep-cell" class:current={e.id === title.id} aria-current={e.id === title.id ? 'page' : undefined}>
              <Card item={e} wide />
            </div>
          {/each}
        </ScrollRow>
      {/if}
    {:catch}{/await}
  {/if}

  {#if title.cast?.length}
    {@const cast = wholeCast ? title.cast : title.cast.slice(0, castShown)}
    <div class="section-head">
      <h2>{title.kind === 'episode' ? t('title.guests') : t('item.cast')}</h2>
      {#if title.cast.length > castShown}
        <button class="link" type="button" aria-expanded={wholeCast} onclick={() => (wholeCast = !wholeCast)}>
          {wholeCast ? t('item.castLess') : t('item.castAll', { count: title.cast.length })}
        </button>
      {/if}
    </div>
    <!-- The first dozen in a row; everyone, a grid. -->
    {#snippet faces()}
      {#each cast as c, i (i)}
        <svelte:element this={c.id ? 'a' : 'div'} class="card person" href={c.id ? personPath(c.id, c.name) : undefined}>
          <div class="poster round">
            {#if c.image}
              <img src={overfin.imageUrl(c.image, 'small')} srcset={srcset(c.image, 'profile')} sizes={sizes.face} alt="" loading="lazy" use:loaded />
            {:else}
              <div class="fallback initials">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            {/if}
          </div>
          <div class="title">{c.name}</div>
          <div class="sub">{c.character ?? ''}</div>
        </svelte:element>
      {/each}
    {/snippet}
    {#if wholeCast}
      <div class="grid">{@render faces()}</div>
    {:else}
      <ScrollRow>{@render faces()}</ScrollRow>
    {/if}
  {/if}
  <Row title={t('item.similar')} items={similar} />
  </div>
{:catch error}
  <PageError {error} />
{/await}
