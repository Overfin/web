<!-- The player, full screen, with its own controls. The SDK does the work
     (choosing how to play, reporting progress, recovering streams,
     takeovers); this is the screen around it.

     Whatever has the focus: ← and → seek 10 s (Shift: 1 min), ↑ and ↓ set
     the volume, Space plays and pauses, F is full screen, M mutes. The
     mouse wheel over the player sets the volume. A click on the picture
     plays or pauses; a double-click is full screen. The controls hide
     after 3 s without moving, and stay while paused. -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Player, Playback, Segment } from '../lib/sdk/overfin.js';
  import { explain, hls, overfin } from '../lib/client';
  import { clock } from '../lib/format';
  import { t, type Key } from '../lib/i18n.svelte';
  import { takeStart } from '../lib/play';
  import SeekBar from '../components/SeekBar.svelte';

  let { id }: { id: string } = $props();

  let root = $state<HTMLDivElement>();
  let video = $state<HTMLVideoElement>();
  let player: Player | null = null;
  let playback = $state<Playback | null>(null);
  let audio = $state('');
  let subtitles = $state('');
  let notice = $state<{ text: string; takenOver: boolean } | null>(null);

  // The video's state, as its events tell it.
  let paused = $state(true);
  let waiting = $state(true);
  let positionMs = $state(0);
  let bufferedMs = $state(0);
  let volume = $state(1);
  let muted = $state(false);
  let fullscreen = $state(false);
  let scrubbing = $state(false);
  // The menu open: audio, subtitles, or none.
  let menu = $state<'' | 'audio' | 'subtitles'>('');
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
    if (menu && (event.target as HTMLElement).closest('.tracks')) return; // the menu scrolls
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
  function drawCues() {
    if (!captions) return;
    const lines = Array.from(cueTrack?.activeCues ?? []) as VTTCue[];
    captions.replaceChildren(...lines.map((cue) => {
      const line = document.createElement('span');
      line.append(cue.getCueAsHTML()); // the server sanitized it (WebVTT, rule 11)
      return line;
    }));
  }
  function followCues() {
    if (!video) return;
    const track = Array.from(video.textTracks).find((tr) => tr.mode !== 'disabled') ?? null;
    if (track && track.mode === 'showing') track.mode = 'hidden';
    if (track === cueTrack) return;
    cueTrack?.removeEventListener('cuechange', drawCues);
    cueTrack = track;
    cueTrack?.addEventListener('cuechange', drawCues);
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
    const sg = player.segmentAt();
    segment = sg && skippable.includes(sg.kind) && player.positionMs < sg.endMs - 1000 ? sg : null;
  }
  const skippable = ['intro', 'recap', 'outro', 'preview', 'commercial'];
  function skip() {
    if (segment) seekTo(segment.endMs);
  }

  onMount(async () => {
    if (!video) return;
    loadVolume();
    video.volume = volume;
    video.muted = muted;
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('keydown', key, { capture: true });
    window.addEventListener('keyup', keyUp, { capture: true });
    try {
      player = await overfin.play(video, id, {
        startMs: takeStart(),
        Hls: await hls(),
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
      });
    } catch (err) {
      notice = { text: explain(err), takenOver: false };
    }
  });
  function onFullscreen() {
    fullscreen = !!document.fullscreenElement;
  }

  // Leaving the screen, or the page, ends the playback.
  function close() {
    const p = player;
    player = null;
    p?.close();
  }
  onDestroy(() => {
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
  function chooseSubtitles(trackId: string) {
    subtitles = trackId;
    player?.setSubtitleTrack(trackId || null);
    menu = '';
    queueMicrotask(followCues);
  }
</script>

<svelte:window onpagehide={close} />

<!-- svelte-ignore a11y_no_static_element_interactions: pointer moves only wake the controls -->
<div class="player" class:idle={!shown} bind:this={root} onpointermove={wake} onpointerdowncapture={(e) => (lastPointer = e.pointerType)} onwheel={wheel}>
  <!-- svelte-ignore a11y_media_has_caption: subtitles come from the server's tracks -->
  <video bind:this={video} autoplay playsinline
    onclick={pictureClick} ondblclick={toggleFullscreen}
    ontimeupdate={timeUpdate} onplay={() => (paused = false)} onpause={() => (paused = true)}
    onwaiting={() => (waiting = true)} onplaying={() => (waiting = false)} oncanplay={() => (waiting = false)}
    onvolumechange={() => { if (video) { volume = video.volume; muted = video.muted; } }}></video>

  {#if waiting && !notice}
    <div class="spinner" aria-label={t('app.loading')}></div>
  {/if}
  <div class="captions" class:raised={shown} bind:this={captions} aria-live="off"></div>
  {#if osd}
    <div class="osd" aria-live="polite">{osd}</div>
  {/if}

  <div class="top controls" role="toolbar" tabindex="-1"
    onpointerenter={() => (overControls = true)} onpointerleave={() => (overControls = false)}>
    <button class="icon" onclick={() => history.back()} aria-label={t('player.back')} title={t('player.back')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" /></svg>
    </button>
    <div class="title">
      {title}
      {#if playback && playback.method !== 'direct'}<span class="method">{t(`player.method.${playback.method}` as Key)}</span>{/if}
    </div>
  </div>

  {#if segment}
    <button class="skip" onclick={skip}>{t(`player.skip.${segment.kind}` as Key)}</button>
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
          <button onclick={() => history.back()}>{t('common.back')}</button>
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
  .method { margin-left: .6rem; font-size: .8rem; font-weight: 400; color: rgba(255, 255, 255, .7); }
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
  .osd {
    position: absolute; z-index: 1; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;
    background: rgba(0, 0, 0, .65); padding: .6rem 1.1rem; border-radius: var(--radius); font-size: 1.3rem; font-weight: 600;
  }
  .spinner {
    position: absolute; z-index: 1; top: 50%; left: 50%; width: 3rem; height: 3rem; margin: -1.5rem 0 0 -1.5rem; pointer-events: none;
    border: 3px solid rgba(255, 255, 255, .25); border-top-color: #fff; border-radius: 50%; animation: spin .9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .notice { position: absolute; z-index: 4; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .8); text-align: center; padding: 2rem; }
  .notice .actions button + button { margin-left: .6rem; }
  @media (max-width: 40rem) {
    .volume input { display: none; }
    .top .title { font-size: .95rem; }
  }
</style>
