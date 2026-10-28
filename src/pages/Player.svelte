<!-- The player, full screen, with its own controls. The SDK does the work
     (choosing how to play, reporting progress, recovering streams,
     takeovers); this is the screen around it.

     Whatever has the focus: ← and → seek 10 s (Shift: 1 min), ↑ and ↓ set
     the volume, Space plays and pauses, F is full screen, M mutes. The
     mouse wheel over the player sets the volume. A click on the picture
     plays or pauses; a double-click is full screen. The controls hide
     after 3 s without moving, and stay while paused. -->
<script lang="ts">
  import { homeChanged } from '../lib/homecache';
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Player, Playback, Segment, Title, TitleSummary } from '../lib/sdk/overfin.js';
  import { explain, hls, overfin } from '../lib/client';
  import { clock, duration } from '../lib/format';
  import { has, i18n, t, type Key } from '../lib/i18n.svelte';
  import { playInstead, takeStart } from '../lib/play';
  import { canGoBack, replace } from '../lib/router.svelte';
  import SeekBar from '../components/SeekBar.svelte';

  let { id }: { id: string } = $props();

  let root = $state<HTMLDivElement>();
  let video = $state<HTMLVideoElement>();
  let player: Player | null = null;
  let playback = $state<Playback | null>(null);
  let audio = $state('');
  let subtitles = $state('');
  let notice = $state<{ text: string; takenOver: boolean } | null>(null);

  // The title's page, for the loading and pause screens: fetched as the
  // player opens, beside the playback.
  let about = $state<Title | null>(null);
  // started: the first picture showed; until then, the loading screen.
  let started = $state(false);
  // blocked: the browser wouldn't start the video by itself (after a
  // refresh, nobody has clicked yet); a click or Space does.
  let blocked = $state(false);

  // The video's state, as its events tell it.
  let paused = $state(true);
  let waiting = $state(true);
  let positionMs = $state(0);
  let bufferedMs = $state(0);
  let volume = $state(1);
  let muted = $state(false);
  let fullscreen = $state(false);
  let scrubbing = $state(false);
  // The menu open: audio, subtitles, the episodes, the settings, or none.
  let menu = $state<'' | 'audio' | 'subtitles' | 'episodes' | 'settings'>('');
  // The seek-bar previews, all fetched as playback starts, so they show
  // at once; kept here so the browser keeps them.
  let sheets: HTMLImageElement[] = [];
  let segment = $state<Segment | null>(null);

  const durationMs = $derived(playback?.durationMs || (video && Number.isFinite(video.duration) ? video.duration * 1000 : 0));

  // What plays, as titles are shown everywhere: an episode with its series.
  const title = $derived.by(() => {
    if (!playback) return '';
    const it = playback.title;
    if (it?.kind === 'episode' && it.series) {
      return `${it.series.name} · ${t('item.seasonEpisodeShort', { season: it.seasonNumber ?? '?', episode: it.episodeNumber ?? '?' })} · ${it.name}`;
    }
    return it?.name ?? '';
  });

  // ---- The loading and pause screens -------------------------------------------

  // What the screens show: the title's page when it's there, else what the
  // playback says.
  const shownTitle = $derived<TitleSummary | null>(about ?? playback?.title ?? null);
  const backdrop = $derived(shownTitle?.images?.backdrops?.[0] ?? shownTitle?.images?.thumb ?? shownTitle?.images?.primary);
  const facts = $derived.by(() => {
    const it = shownTitle;
    if (!it) return '';
    if (it.kind === 'episode') {
      return [t('item.seasonEpisodeShort', { season: it.seasonNumber ?? '?', episode: it.episodeNumber ?? '?' }), it.name].join(' · ');
    }
    return [it.year, it.durationMs ? duration(it.durationMs) : '', it.certification].filter(Boolean).join(' · ');
  });
  // The pause screen comes after a second paused, so a quick pause doesn't
  // flash it.
  let pauseScreen = $state(false);
  $effect(() => {
    if (!paused || !started || scrubbing || menu || notice) {
      pauseScreen = false;
      return;
    }
    const wait = setTimeout(() => (pauseScreen = true), 1000);
    return () => clearTimeout(wait);
  });

  // ---- Volume, kept for next time ----------------------------------------

  const saved = 'overfin-web-volume';
  function loadVolume() {
    try {
      const v = JSON.parse(localStorage.getItem(saved) || 'null');
      if (v && typeof v.volume === 'number') {
        volume = Math.min(1, Math.max(0, v.volume));
        muted = !!v.muted;
      }
    } catch {
      // private browsing: the default
    }
  }
  function setVolume(v: number, mute = false) {
    volume = Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
    muted = mute;
    if (video) {
      video.volume = volume;
      video.muted = muted;
    }
    try {
      localStorage.setItem(saved, JSON.stringify({ volume, muted }));
    } catch {
      // not kept
    }
  }

  // ---- What the person does ------------------------------------------------

  // A short sign in the middle: the new volume, or how far it jumped.
  let osd = $state('');
  let osdTimer: ReturnType<typeof setTimeout> | undefined;
  function sign(text: string) {
    osd = text;
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => (osd = ''), 900);
  }

  // tryStart starts a ready video the browser didn't start by itself,
  // noting when it refuses until someone acts.
  function tryStart() {
    if (started || !video || !video.paused || !video.autoplay) return;
    video.play().catch((err) => {
      if (err?.name === 'NotAllowedError') blocked = true;
    });
  }

  function togglePlay() {
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }
  function seekTo(ms: number) {
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, ms), durationMs || ms) / 1000;
    positionMs = video.currentTime * 1000;
  }
  function jump(seconds: number) {
    if (!video) return;
    seekTo(video.currentTime * 1000 + seconds * 1000);
    sign(`${seconds > 0 ? '+' : '−'}${Math.abs(seconds) >= 60 ? `${Math.abs(seconds) / 60} min` : `${Math.abs(seconds)} s`}`);
  }
  function nudgeVolume(step: number) {
    setVolume(volume + step);
    sign(t('player.volumeLevel', { n: Math.round(volume * 100) }));
  }
  function toggleMute() {
    setVolume(volume, !muted);
    sign(muted ? t('player.muted') : t('player.volumeLevel', { n: Math.round(volume * 100) }));
  }

  async function toggleFullscreen() {
    const el = root as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    } else if (el?.requestFullscreen) {
      await el.requestFullscreen().catch(() => {});
    } else {
      // iPhones only put the video itself full screen.
      (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
    }
  }
  const canPip = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  function togglePip() {
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else video?.requestPictureInPicture().catch(() => {});
  }

  // The keys, whatever has the focus: caught before anything focused sees
  // them. Other keys go on as usual (Tab, Enter in a menu, Escape).
  function key(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || notice) return;
    const long = event.shiftKey ? 60 : 10;
    switch (event.key) {
      case 'ArrowLeft': jump(-long); break;
      case 'ArrowRight': jump(long); break;
      case 'ArrowUp': nudgeVolume(0.05); break;
      case 'ArrowDown': nudgeVolume(-0.05); break;
      case ' ': case 'Spacebar': togglePlay(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'm': case 'M': toggleMute(); break;
      case 'n': case 'N':
        if (!next) return;
        goNext();
        break;
      case 'Escape':
        if (!menu) return; // the browser leaves full screen by itself
        menu = '';
        break;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
    wake();
  }

  // A focused button acts on Space's release: that's kept from it too.
  function keyUp(event: KeyboardEvent) {
    if ((event.key === ' ' || event.key === 'Spacebar') && !notice) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // A click on the picture plays or pauses; with the menu open, it closes
  // the menu; on a touch screen with the controls hidden, a tap only shows
  // them.
  let lastPointer = 'mouse';
  function pictureClick() {
    if (menu) {
      menu = '';
      return;
    }
    if (lastPointer !== 'mouse' && !shown) {
      wake();
      return;
    }
    togglePlay();
  }

  // The wheel over the player: one step a notch; a touchpad's small moves
  // add up to a step.
  let wheelRest = 0;
  function wheel(event: WheelEvent) {
    if (menu && (event.target as HTMLElement).closest('.tracks, .episodes')) return; // the menu scrolls
    event.preventDefault();
    const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    if (Math.abs(dy) >= 50) {
      wheelRest = 0;
      nudgeVolume(dy < 0 ? 0.05 : -0.05);
    } else {
      wheelRest += dy;
      if (Math.abs(wheelRest) >= 50) {
        nudgeVolume(wheelRest < 0 ? 0.05 : -0.05);
        wheelRest = 0;
      }
    }
    wake();
  }

  // ---- The controls showing, or not ------------------------------------------

  let shown = $state(true);
  let overControls = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  function wake() {
    shown = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!paused && !menu && !scrubbing && !overControls) shown = false;
    }, 3000);
  }
  $effect(() => {
    if (paused || menu) shown = true;
    else wake();
  });

  // Subtitles are drawn here, not by the browser: above the controls
  // while they show, at the bottom when they hide, in Overfin's style. The
  // browser still reads the track the SDK turns on (kept hidden), and says
  // when its lines change.
  let captions = $state<HTMLDivElement>();
  let cueTrack: TextTrack | null = null;
  let drawn = '';
  function drawCues() {
    if (!captions) return;
    // The lines at this time, from the cues: the browser's active cues
    // lag while paused at the start.
    const now = video?.currentTime ?? 0;
    const lines = (Array.from(cueTrack?.cues ?? []) as VTTCue[]).filter((c) => c.startTime <= now && now < c.endTime);
    const shownNow = lines.map((c) => c.text).join('\n');
    if (shownNow === drawn) return;
    drawn = shownNow;
    captions.replaceChildren(...lines.map((cue) => {
      const line = document.createElement('span');
      line.append(cue.getCueAsHTML()); // the server sanitized it (WebVTT, rule 11)
      return line;
    }));
  }
  function followCues() {
    if (!video) return;
    // A track's lines arrive when its file has loaded.
    for (const el of Array.from(video.querySelectorAll('track'))) {
      if (!el.dataset.followed) {
        el.dataset.followed = '1';
        el.addEventListener('load', () => {
          drawn = '\u0000';
          drawCues();
        });
      }
    }
    const track = Array.from(video.textTracks).find((tr) => tr.mode !== 'disabled') ?? null;
    if (track && track.mode === 'showing') track.mode = 'hidden';
    if (track === cueTrack) return;
    cueTrack?.removeEventListener('cuechange', drawCues);
    cueTrack = track;
    cueTrack?.addEventListener('cuechange', drawCues);
    drawn = '\u0000'; // drawn again, whatever was there
    drawCues();
  }

  // ---- The video's events ------------------------------------------------------

  function timeUpdate() {
    if (!video || !player) return;
    if (!scrubbing) positionMs = video.currentTime * 1000;
    const b = video.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= video.currentTime + 1 && b.end(i) >= video.currentTime) bufferedMs = b.end(i) * 1000;
    }
    followCues();
    drawCues();
    const sg = player.segmentAt();
    segment = sg && skippable.includes(sg.kind) && player.positionMs < sg.endMs - 1000 ? sg : null;
  }
  const skippable = ['intro', 'recap', 'outro', 'preview', 'commercial'];

  // ---- The next episode ------------------------------------------------------

  // Offered when the credits start, or 30 s before the end: it plays
  // after a 10 s countdown (counted while playing), at once with "Play
  // now" or N, or not after "Cancel". The end of the episode plays it too.
  const next = $derived(playback?.next?.playable ? playback.next : null);
  let dismissed = $state(false);
  let countdown = $state(0);
  const upNextAt = $derived.by(() => {
    if (!next || durationMs < 120_000) return Infinity;
    const credits = playback?.segments?.find((sg) => sg.kind === 'outro');
    return Math.min(credits ? credits.startMs : Infinity, durationMs - 30_000);
  });
  const upNext = $derived(!!next && !dismissed && positionMs >= upNextAt);
  $effect(() => {
    if (!upNext) {
      countdown = 0;
      return;
    }
    if (untrack(() => countdown) === 0) countdown = 10;
    if (paused) return;
    const tick = setInterval(() => {
      countdown = untrack(() => countdown) - 1;
      if (countdown <= 0) {
        clearInterval(tick);
        goNext();
      }
    }, 1000);
    return () => clearInterval(tick);
  });
  function goNext() {
    const n = next;
    if (!n) return;
    close();
    playInstead(n.id, n.userState?.played ? 0 : (n.userState?.positionMs ?? 0));
  }

  // ---- Quality and how it plays ------------------------------------------------

  // Limits offered: those below the file's own bitrate (above, nothing
  // would change).
  const qualities = [40_000, 20_000, 10_000, 6_000, 4_000, 2_000, 1_000];
  const offered = $derived(qualities.filter((k) => !playback?.info?.bitrateKbps || k < playback.info.bitrateKbps));
  let maxBitrate = $state(0);
  let showInfo = $state(false);
  function chooseQuality(kbps: number) {
    menu = '';
    if (kbps === maxBitrate) return;
    maxBitrate = kbps;
    player?.setMaxBitrate(kbps);
  }
  const mbps = (kbps: number) => `${(kbps / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Mb/s`;
  const rangeName = (r?: string) => !r ? '' : r === 'SDR' ? 'SDR' : r === 'HDR10Plus' ? 'HDR10+'
    : r.startsWith('DOVI') ? `Dolby Vision${r.includes('HDR10Plus') ? ' (HDR10+)' : r.includes('HDR10') ? ' (HDR10)' : r.includes('HLG') ? ' (HLG)' : ''}` : r;
  // A language's name in the site's language, from a media file's code
  // ("fre", "eng"…); the code itself when it's not known.
  const bibliographic: Record<string, string> = { fre: 'fr', ger: 'de', chi: 'zh', cze: 'cs', dut: 'nl', gre: 'el', per: 'fa',
    rum: 'ro', slo: 'sk', ice: 'is', may: 'ms', wel: 'cy', baq: 'eu', geo: 'ka', arm: 'hy', alb: 'sq', bur: 'my', mac: 'mk', mao: 'mi' };
  function languageName(code?: string) {
    if (!code) return '';
    try {
      const name = new Intl.DisplayNames([i18n.locale], { type: 'language' }).of(bibliographic[code] ?? code);
      return name && name !== code ? name : code;
    } catch {
      return code;
    }
  }
  const reasonText = (r: string) => has(`player.reason.${r}`) ? t(`player.reason.${r}` as Key) : r;
  const videoLine = $derived.by(() => {
    const v = playback?.info?.video;
    if (!v) return '';
    return [[v.codec?.toUpperCase(), v.profile].filter(Boolean).join(' '), v.width && v.height ? `${v.width}×${v.height}` : '',
      v.bitDepth ? `${v.bitDepth} bits` : '', rangeName(v.range), v.bitrateKbps ? mbps(v.bitrateKbps) : ''].filter(Boolean).join(' · ');
  });
  const audioLine = $derived.by(() => {
    const a = playback?.info?.audio;
    if (!a) return '';
    const ch = a.channels === 6 ? '5.1' : a.channels === 8 ? '7.1' : a.channels === 2 ? t('player.stereo') : a.channels ? `${a.channels} ch` : '';
    return [a.codec?.toUpperCase(), ch, languageName(a.language), a.bitrateKbps ? mbps(a.bitrateKbps) : ''].filter(Boolean).join(' · ');
  });

  // ---- The episodes, without leaving -------------------------------------------

  let seasons = $state<TitleSummary[]>([]);
  let seasonId = $state('');
  let episodes = $state<TitleSummary[] | null>(null);
  async function openEpisodes() {
    if (menu === 'episodes') {
      menu = '';
      return;
    }
    menu = 'episodes';
    const ep = playback?.title;
    if (!ep?.series) return;
    if (!seasons.length) seasons = (await overfin.title(ep.series.id).catch(() => null))?.seasons ?? [];
    await showSeason(seasonId || ep.season?.id || '');
  }
  async function showSeason(id: string) {
    if (!id) return;
    seasonId = id;
    episodes = null;
    const found = (await overfin.title(id).catch(() => null))?.episodes ?? [];
    if (seasonId === id) episodes = found; // not if another season was chosen since
  }
  function playEpisode(e: TitleSummary) {
    menu = '';
    if (e.id === playback?.title?.id || !e.playable) return;
    close();
    playInstead(e.id, e.userState?.played ? 0 : (e.userState?.positionMs ?? 0));
  }
  function skip() {
    if (segment) seekTo(segment.endMs);
  }

  onMount(async () => {
    if (!video) return;
    overfin.title(id).then((t) => (about = t), () => {});
    loadVolume();
    video.volume = volume;
    video.muted = muted;
    document.addEventListener('fullscreenchange', onFullscreen);
    // A subtitle track turned on or off (by the SDK, or as the stream
    // starts), even while paused.
    video.textTracks.addEventListener('change', followCues);
    video.textTracks.addEventListener('addtrack', followCues);
    window.addEventListener('keydown', key, { capture: true });
    window.addEventListener('keyup', keyUp, { capture: true });
    try {
      player = await overfin.play(video, id, {
        startMs: takeStart(),
        Hls: await hls(),
        // The site's language, when the video has it.
        audioLanguage: i18n.locale,
        // Every (re)start: the title and the track menus.
        onStart(pb) {
          notice = null;
          playback = pb;
          sheets = (pb.trickplay?.sheets ?? []).map((url) => {
            const img = new Image();
            img.src = url;
            return img;
          });
          audio = pb.audioTrack ?? '';
          subtitles = player?.subtitleTrack ?? pb.subtitleTrack ?? '';
        },
        onTakenOver(device) {
          notice = { text: t('player.takenOver', { device: device || t('player.anotherDevice') }), takenOver: true };
        },
        onError(err) {
          notice = { text: explain(err), takenOver: false };
        },
        // At the end of an episode, the next one, unless cancelled.
        onEnded() {
          if (next && !dismissed) goNext();
        },
      });
      // Left while it was starting: nobody watches it.
      if (left) close();
    } catch (err) {
      notice = { text: explain(err), takenOver: false };
    }
  });
  function onFullscreen() {
    fullscreen = !!document.fullscreenElement;
  }

  // Back where the person came from; opened from a link, to the title's
  // page.
  function back() {
    if (canGoBack()) history.back();
    else replace(`/title/${id}`);
  }

  // Leaving the screen, or the page, ends the playback.
  let left = false;
  function close() {
    homeChanged(); // where it stopped shows in Continue Watching
    const p = player;
    player = null;
    p?.close();
  }
  onDestroy(() => {
    left = true;
    close();
    clearTimeout(hideTimer);
    clearTimeout(osdTimer);
    window.removeEventListener('keydown', key, { capture: true });
    window.removeEventListener('keyup', keyUp, { capture: true });
    document.removeEventListener('fullscreenchange', onFullscreen);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });

  function chooseAudio(trackId: string) {
    audio = trackId;
    player?.setAudioTrack(trackId);
    menu = '';
  }
  // The subtitles chosen are the profile's from now on: their language
  // (or none) starts its next playbacks. A track without a known
  // language changes nothing kept.
  function chooseSubtitles(trackId: string) {
    subtitles = trackId;
    player?.setSubtitleTrack(trackId || null);
    menu = '';
    queueMicrotask(followCues);
    const language = trackId ? playback?.subtitleTracks?.find((tr) => tr.id === trackId)?.language : '';
    if (language !== undefined) overfin.setSubtitleLanguage(language).catch(() => {});
  }
</script>

<svelte:window onpagehide={close} />

<!-- svelte-ignore a11y_no_static_element_interactions: pointer moves only wake the controls -->
<div class="player" class:idle={!shown} bind:this={root} onpointermove={wake} onpointerdowncapture={(e) => (lastPointer = e.pointerType)} onwheel={wheel}>
  <!-- svelte-ignore a11y_media_has_caption: subtitles come from the server's tracks -->
  <video bind:this={video} autoplay playsinline
    onclick={pictureClick} ondblclick={toggleFullscreen}
    ontimeupdate={timeUpdate} onplay={() => { paused = false; blocked = false; }} onpause={() => (paused = true)}
    onwaiting={() => (waiting = true)} onplaying={() => { waiting = false; started = true; }} oncanplay={() => { waiting = false; tryStart(); }}
    onvolumechange={() => { if (video) { volume = video.volume; muted = video.muted; } }}></video>

  {#if !started && !notice}
    <div class="loading">
      {#if backdrop}<img class="backdrop" src={overfin.imageUrl(backdrop, 'large')} alt="" />{/if}
      <div class="loading-title">
        {#if shownTitle?.images?.logo}
          <img class="logo" src={overfin.imageUrl(shownTitle.images.logo, 'medium')} alt={shownTitle.series?.name ?? shownTitle.name} />
        {:else if shownTitle}
          <div class="name">{shownTitle.series?.name ?? shownTitle.name}</div>
        {/if}
        {#if facts}<div class="facts">{facts}</div>{/if}
        {#if blocked}
          <button class="start" onclick={togglePlay} aria-label={t('player.play')} title={t('player.play')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
        {:else}
          <div class="spinner inline" aria-label={t('app.loading')}></div>
        {/if}
      </div>
    </div>
  {/if}
  {#if pauseScreen && shownTitle}
    <div class="paused-screen">
      <div class="paused-about">
        <div class="watching">{t('player.watching')}</div>
        {#if shownTitle.images?.logo}
          <img class="logo" src={overfin.imageUrl(shownTitle.images.logo, 'medium')} alt={shownTitle.series?.name ?? shownTitle.name} />
        {:else}
          <h1>{shownTitle.series?.name ?? shownTitle.name}</h1>
        {/if}
        {#if facts}<div class="facts">{facts}</div>{/if}
        {#if about?.overview}<p class="overview">{about.overview}</p>{/if}
      </div>
    </div>
  {/if}
  {#if waiting && started && !notice}
    <div class="spinner" aria-label={t('app.loading')}></div>
  {/if}
  <div class="captions" class:raised={shown} bind:this={captions} aria-live="off"></div>
  {#if osd}
    <div class="osd" aria-live="polite">{osd}</div>
  {/if}

  <div class="top controls" role="toolbar" tabindex="-1"
    onpointerenter={() => (overControls = true)} onpointerleave={() => (overControls = false)}>
    <button class="icon" onclick={back} aria-label={t('player.back')} title={t('player.back')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" /></svg>
    </button>
    <div class="title">
      {title}
    </div>
  </div>

  {#if segment && !(upNext && segment.kind === 'outro')}
    <button class="skip" onclick={skip}>{t(`player.skip.${segment.kind}` as Key)}</button>
  {/if}

  {#if upNext && next}
    <div class="upnext" role="dialog" aria-label={t('player.next')}>
      <div class="still">
        {#if next.images?.primary}<img src={overfin.imageUrl(next.images.primary, 'small')} alt="" />{/if}
      </div>
      <div class="about">
        <div class="label">{t('player.next')} · {t('player.nextIn', { n: countdown })}</div>
        <div class="name">{t('item.seasonEpisodeShort', { season: next.seasonNumber ?? '?', episode: next.episodeNumber ?? '?' })} · {next.name}</div>
        <div class="choices">
          <button class="primary" onclick={goNext}>{t('player.playNow')}</button>
          <button onclick={() => (dismissed = true)}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showInfo && playback}
    <div class="info-panel">
      <button class="close" type="button" aria-label={t('common.close')} onclick={() => (showInfo = false)}>✕</button>
      <dl>
        <dt>{t('player.infoMethod')}</dt>
        <dd>{t(`player.infoMethod.${playback.method}` as Key)}</dd>
        {#if playback.info?.reasons?.length}
          <dt>{t('player.infoWhy')}</dt>
          <dd>{#each playback.info.reasons as r}<div>{reasonText(r)}</div>{/each}</dd>
        {/if}
        {#if videoLine}<dt>{t('player.infoVideo')}</dt><dd>{videoLine}</dd>{/if}
        {#if audioLine}<dt>{t('player.audio')}</dt><dd>{audioLine}</dd>{/if}
        {#if playback.info?.container}
          <dt>{t('player.infoFile')}</dt>
          <dd>{[playback.info.container.toUpperCase(), playback.info.bitrateKbps ? mbps(playback.info.bitrateKbps) : ''].filter(Boolean).join(' · ')}</dd>
        {/if}
        <dt>{t('player.quality')}</dt>
        <dd>{maxBitrate ? mbps(maxBitrate) : t('player.qualityAuto')}</dd>
      </dl>
    </div>
  {/if}

  {#if menu === 'episodes'}
    <aside class="episodes" aria-label={t('player.episodes')}>
      {#if seasons.length > 1}
        <div class="season-tabs">
          {#each seasons as s (s.id)}
            <button class="tab" class:active={s.id === seasonId} onclick={() => showSeason(s.id)}>{s.name}</button>
          {/each}
        </div>
      {/if}
      {#if episodes === null}
        <p class="muted">{t('app.loading')}</p>
      {:else}
        {#each episodes as e (e.id)}
          <button class="episode" class:current={e.id === playback?.title?.id} disabled={!e.playable && e.id !== playback?.title?.id}
            onclick={() => playEpisode(e)}>
            <span class="still">{#if e.images?.primary}<img src={overfin.imageUrl(e.images.primary, 'small')} alt="" loading="lazy" />{/if}</span>
            <span class="text">
              <span class="name">{e.episodeNumber}. {e.name}</span>
              {#if e.durationMs}<span class="hint">{duration(e.durationMs)}{#if e.userState?.played} · ✓{/if}</span>{/if}
            </span>
          </button>
        {/each}
      {/if}
    </aside>
  {/if}

  <div class="bottom controls" role="toolbar" tabindex="-1"
    onpointerenter={() => (overControls = true)} onpointerleave={() => (overControls = false)}>
    <SeekBar {positionMs} {durationMs} {bufferedMs} trickplay={playback?.trickplay} seek={seekTo} bind:scrubbing />
    <div class="buttons">
      <button class="icon" onclick={togglePlay} aria-label={paused ? t('player.play') : t('player.pause')} title={paused ? t('player.play') : t('player.pause')}>
        {#if paused}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        {/if}
      </button>
      {#if next}
        <button class="icon" onclick={goNext} aria-label={t('player.next')} title={t('player.next') + ' (N)'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18l8.5-6L6 6zm10-12v12h2V6z" /></svg>
        </button>
      {/if}
      <div class="volume">
        <button class="icon" onclick={toggleMute} aria-label={muted ? t('player.unmute') : t('player.mute')} title={muted ? t('player.unmute') : t('player.mute')}>
          {#if muted || volume === 0}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
          {/if}
        </button>
        <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label={t('player.volume')}
          oninput={(e) => setVolume(Number((e.currentTarget as HTMLInputElement).value))} />
      </div>
      <span class="clock">{clock(positionMs)} / {clock(durationMs)}</span>
      <span class="grow"></span>
      {#if playback?.title?.kind === 'episode' && playback.title.series}
        <button class="icon" class:on={menu === 'episodes'} onclick={openEpisodes} aria-expanded={menu === 'episodes'}
          aria-label={t('player.episodes')} title={t('player.episodes')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h4v4H3zm6 1h12v2H9zM3 10h4v4H3zm6 1h12v2H9zm-6 4h4v4H3zm6 1h12v2H9z" /></svg>
        </button>
      {/if}
      {#if playback?.audioTracks?.length}
        <div class="menuwrap">
          <button class="icon" class:on={menu === 'audio'} onclick={() => (menu = menu === 'audio' ? '' : 'audio')}
            aria-expanded={menu === 'audio'} aria-label={t('player.audio')} title={t('player.audio')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12.9 15-2.5-2.5v-.1A17 17 0 0 0 14 6h3V4h-7V2H8v2H1v2h11.2c-.7 1.9-1.7 3.8-3.2 5.4-1-1.1-1.8-2.3-2.4-3.4h-2c.7 1.6 1.7 3.2 3 4.6l-5 5L4 19l5-5 3.1 3.1zm5.6-5h-2L12 22h2l1.1-3h4.8l1.1 3h2zm-2.6 7 1.6-4.3 1.6 4.3z" /></svg>
          </button>
          {#if menu === 'audio'}
            <div class="tracks" role="dialog" aria-label={t('player.audio')}>
              <h3>{t('player.audio')}</h3>
              {#each playback.audioTracks as track (track.id)}
                <button class="choice" class:chosen={audio === track.id} onclick={() => chooseAudio(track.id)}>{track.label}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      {#if playback?.subtitleTracks?.length}
        <div class="menuwrap">
          <button class="icon" class:on={menu === 'subtitles'} onclick={() => (menu = menu === 'subtitles' ? '' : 'subtitles')}
            aria-expanded={menu === 'subtitles'} aria-label={t('player.subtitles')} title={t('player.subtitles')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM4 12h4v2H4zm10 6H4v-2h10zm6 0h-4v-2h4zm0-4H10v-2h10z" /></svg>
          </button>
          {#if menu === 'subtitles'}
            <div class="tracks" role="dialog" aria-label={t('player.subtitles')}>
              <h3>{t('player.subtitles')}</h3>
              <button class="choice" class:chosen={!subtitles} onclick={() => chooseSubtitles('')}>{t('player.noSubtitles')}</button>
              {#each playback.subtitleTracks as track (track.id)}
                <button class="choice" class:chosen={subtitles === track.id} onclick={() => chooseSubtitles(track.id)}>{track.label}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <div class="menuwrap">
        <button class="icon" class:on={menu === 'settings'} onclick={() => (menu = menu === 'settings' ? '' : 'settings')}
          aria-expanded={menu === 'settings'} aria-label={t('player.settings')} title={t('player.settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.4-2.7a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" /></svg>
        </button>
        {#if menu === 'settings'}
          <div class="tracks" role="dialog" aria-label={t('player.settings')}>
            <h3>{t('player.quality')}</h3>
            <button class="choice" class:chosen={!maxBitrate} onclick={() => chooseQuality(0)}>{t('player.qualityAuto')}</button>
            {#each offered as kbps (kbps)}
              <button class="choice" class:chosen={maxBitrate === kbps} onclick={() => chooseQuality(kbps)}>{mbps(kbps)}</button>
            {/each}
            <h3>{t('player.info')}</h3>
            <button class="choice" class:chosen={showInfo} onclick={() => { showInfo = !showInfo; menu = ''; }}>{t('player.showInfo')}</button>
          </div>
        {/if}
      </div>
      {#if canPip}
        <button class="icon" onclick={togglePip} aria-label={t('player.pip')} title={t('player.pip')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 11h-8v6h8zm4 8V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2zm-2 0H3V5h18z" /></svg>
        </button>
      {/if}
      <button class="icon" onclick={toggleFullscreen} aria-label={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
        title={fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}>
        {#if fullscreen}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z" /></svg>
        {/if}
      </button>
    </div>
  </div>

  {#if notice}
    <div class="notice">
      <div>
        <p>{notice.text}</p>
        <div class="actions">
          {#if notice.takenOver}
            <button class="primary" onclick={() => player?.continueHere()}>{t('player.continueHere')}</button>
          {/if}
          <button onclick={back}>{t('common.back')}</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Old TVs' browsers (Chromium 79) know neither inset nor gap in flex
     rows: positions and margins spelled out. */
  .player { position: fixed; top: 0; right: 0; bottom: 0; left: 0; background: #000; z-index: 10; overflow: hidden; color: #fff; }
  .player.idle { cursor: none; }
  /* Layers, spelled out: a video can be composited above what follows it. */
  video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 0; }
  .controls { position: absolute; z-index: 2; left: 0; right: 0; padding: .6rem clamp(.75rem, 2vw, 1.5rem); transition: opacity .25s; }
  .idle .controls, .idle .skip { opacity: 0; pointer-events: none; }
  .top { top: 0; display: flex; align-items: center; background: linear-gradient(rgba(0, 0, 0, .7), transparent); padding-bottom: 2.5rem; }
  .top .title { margin-left: .5rem; font-size: 1.05rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px #000; }
  .bottom { bottom: 0; background: linear-gradient(transparent, rgba(0, 0, 0, .75)); padding-top: 3rem; }
  .buttons { display: flex; align-items: center; }
  .buttons > * + * { margin-left: .35rem; }
  .grow { flex: 1; }
  .icon {
    width: 2.75rem; height: 2.75rem; min-height: 0; padding: .55rem; background: none; border: none; border-radius: 50%;
    color: #fff; display: inline-flex; align-items: center; justify-content: center;
  }
  .icon:hover, .icon.on { background: rgba(255, 255, 255, .15); }
  .icon svg { width: 100%; height: 100%; fill: currentColor; }
  .volume { display: flex; align-items: center; }
  .volume input { width: 6rem; min-height: 0; padding: 0; margin-left: .2rem; accent-color: var(--accent); background: none; border: none; }
  .clock { font-variant-numeric: tabular-nums; font-size: .9rem; margin-left: .6rem; white-space: nowrap; }
  .skip {
    position: absolute; z-index: 2; right: clamp(.75rem, 2vw, 1.5rem); bottom: 7rem; transition: opacity .25s;
    background: rgba(20, 22, 28, .85); border: 1px solid rgba(255, 255, 255, .4); color: #fff; font-weight: 600;
  }
  .menuwrap { position: relative; }
  .tracks {
    position: absolute; z-index: 3; right: 0; bottom: 3.2rem; min-width: 15rem; max-height: 60vh; overflow-y: auto;
    background: rgba(20, 22, 28, .95); border: 1px solid rgba(255, 255, 255, .15); border-radius: var(--radius); padding: .4rem;
  }
  .tracks h3 { margin: .4rem .6rem .2rem; font-size: .8rem; font-weight: 600; color: rgba(255, 255, 255, .6); text-transform: uppercase; letter-spacing: .04em; }
  .choice {
    display: block; width: 100%; text-align: left; background: none; border: none; color: #fff; min-height: 2.4rem;
    padding: .4rem .6rem .4rem 1.8rem; border-radius: var(--radius-s); position: relative;
  }
  .choice:hover { background: rgba(255, 255, 255, .1); }
  .choice.chosen::before { content: '✓'; position: absolute; left: .6rem; color: var(--accent); }
  .captions {
    position: absolute; z-index: 1; left: 5%; right: 5%; bottom: 4%; text-align: center; pointer-events: none;
    transition: bottom .25s; font-size: clamp(1rem, 2.6vw, 2.1rem); line-height: 1.35; color: #fff;
  }
  .captions.raised { bottom: 9.5rem; }
  .captions :global(span) {
    display: table; margin: 0 auto .15em; padding: .05em .4em; background: rgba(0, 0, 0, .65); border-radius: 4px;
    white-space: pre-line; text-shadow: 0 1px 2px #000;
  }
  .upnext {
    position: absolute; z-index: 3; right: clamp(.75rem, 2vw, 1.5rem); bottom: 7.5rem; display: flex; align-items: stretch;
    width: min(30rem, 92vw); background: rgba(20, 22, 28, .95); border: 1px solid rgba(255, 255, 255, .15); border-radius: var(--radius); overflow: hidden;
  }
  .upnext .still { flex: none; width: 9rem; background: #000; }
  .upnext .still img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .upnext .about { padding: .6rem .8rem; min-width: 0; }
  .upnext .label { font-size: .8rem; color: rgba(255, 255, 255, .7); }
  .upnext .name { font-weight: 600; margin: .15rem 0 .5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .upnext .choices { display: flex; flex-wrap: nowrap; }
  .upnext .choices button { min-height: 2.2rem; padding: .3rem .9rem; font-size: .9rem; white-space: nowrap; }
  .upnext .choices button + button { margin-left: .4rem; }
  aside.episodes {
    position: absolute; z-index: 3; top: 4rem; right: clamp(.75rem, 2vw, 1.5rem); bottom: 5.5rem; width: min(24rem, 90vw);
    overflow-y: auto; padding: .8rem; background: rgba(14, 16, 20, .97); border: 1px solid rgba(255, 255, 255, .12);
    border-radius: var(--radius);
  }
  .season-tabs { display: flex; flex-wrap: wrap; margin-bottom: .6rem; }
  .season-tabs .tab { min-height: 2rem; padding: .2rem .7rem; margin: 0 .35rem .35rem 0; border-radius: 999px; font-size: .85rem; }
  .season-tabs .tab.active { background: #fff; color: #000; border-color: #fff; }
  .episode {
    display: flex; align-items: center; justify-content: flex-start; width: 100%; text-align: left; background: none; border: none; color: #fff;
    padding: .4rem; margin-bottom: .2rem; border-radius: var(--radius-s); min-height: 0;
  }
  .episode:hover:not(:disabled), .episode.current { background: rgba(255, 255, 255, .1); }
  .episode:disabled { opacity: .45; cursor: default; }
  .episode .still { flex: none; width: 7rem; height: 3.95rem; border-radius: 4px; overflow: hidden; background: #000; margin-right: .6rem; }
  .episode .still img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .episode .text { display: flex; flex-direction: column; min-width: 0; }
  .episode .name { font-weight: 600; font-size: .92rem; }
  .episode .hint { font-size: .8rem; color: rgba(255, 255, 255, .6); }
  .loading, .paused-screen { pointer-events: none; }
  .loading .start {
    pointer-events: auto; display: block; margin: 1.4rem auto 0; width: 4.5rem; height: 4.5rem; padding: 1.1rem;
    border: none; border-radius: 50%; background: rgba(255, 255, 255, .92); color: #000; cursor: pointer;
  }
  .loading .start svg { width: 100%; height: 100%; fill: currentColor; display: block; }
  .loading .start:hover, .loading .start:focus-visible { background: #fff; transform: scale(1.06); }
  .loading { position: absolute; z-index: 1; top: 0; right: 0; bottom: 0; left: 0; background: #000; display: flex; align-items: center; justify-content: center; }
  .loading .backdrop { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: .35; filter: blur(2px); }
  .loading-title { position: relative; text-align: center; padding: 0 1.5rem; }
  .loading-title .logo, .paused-about .logo { max-width: min(26rem, 70vw); max-height: 9rem; object-fit: contain; display: block; }
  .loading-title .logo { margin: 0 auto; }
  .loading-title .name { font-size: clamp(1.6rem, 4vw, 2.6rem); font-weight: 700; }
  .loading-title .facts { margin-top: .6rem; color: rgba(255, 255, 255, .8); }
  .paused-screen {
    position: absolute; z-index: 1; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center;
    background: linear-gradient(90deg, rgba(0, 0, 0, .85), rgba(0, 0, 0, .55) 55%, rgba(0, 0, 0, .25)); animation: fade .4s;
  }
  .paused-about { max-width: min(36rem, 80vw); padding: 0 clamp(1.5rem, 6vw, 5rem); }
  .watching { color: rgba(255, 255, 255, .7); font-size: .95rem; margin-bottom: .6rem; }
  .paused-about h1 { margin: 0; font-size: clamp(1.8rem, 4vw, 3rem); }
  .paused-about .facts { margin: .8rem 0 .4rem; font-weight: 600; }
  .paused-about .overview {
    margin: .4rem 0 0; color: rgba(255, 255, 255, .85); line-height: 1.5;
    display: -webkit-box; -webkit-line-clamp: 5; line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;
  }
  @keyframes fade { from { opacity: 0; } }
  .info-panel {
    position: absolute; z-index: 3; top: 4rem; left: clamp(.75rem, 2vw, 1.5rem); max-width: min(30rem, 90vw);
    background: rgba(14, 16, 20, .9); border: 1px solid rgba(255, 255, 255, .15); border-radius: var(--radius);
    padding: .7rem 2.2rem .7rem .9rem; font-size: .88rem;
  }
  .info-panel dl { margin: 0; display: grid; grid-template-columns: auto 1fr; }
  .info-panel dt { color: rgba(255, 255, 255, .6); padding: .15rem 1rem .15rem 0; }
  .info-panel dd { margin: 0; padding: .15rem 0; }
  .info-panel .close { position: absolute; top: .3rem; right: .3rem; background: none; border: none; color: #fff; min-height: 0; padding: .3rem .5rem; }
  .osd {
    position: absolute; z-index: 1; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;
    background: rgba(0, 0, 0, .65); padding: .6rem 1.1rem; border-radius: var(--radius); font-size: 1.3rem; font-weight: 600;
  }
  .spinner {
    position: absolute; z-index: 1; top: 50%; left: 50%; width: 3rem; height: 3rem; margin: -1.5rem 0 0 -1.5rem; pointer-events: none;
    border: 3px solid rgba(255, 255, 255, .25); border-top-color: #fff; border-radius: 50%; animation: spin .9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner.inline { position: relative; top: auto; left: auto; margin: 1.4rem auto 0; display: block; }
  .notice { position: absolute; z-index: 4; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .8); text-align: center; padding: 2rem; }
  .notice .actions button + button { margin-left: .6rem; }
  @media (max-width: 40rem) {
    .volume input { display: none; }
    .top .title { font-size: .95rem; }
  }
</style>
