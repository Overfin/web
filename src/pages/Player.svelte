<!-- The player, full screen. The SDK does the work (choosing how to play,
     reporting progress, recovering streams, takeovers); this is the screen
     around it: audio and subtitles, "Skip intro", and what happened. -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Player, Playback, Segment } from '../lib/sdk/overfin.js';
  import { explain, hls, overfin } from '../lib/client';
  import { t, type Key } from '../lib/i18n.svelte';
  import { takeStart } from '../lib/play';

  let { id }: { id: string } = $props();

  let video = $state<HTMLVideoElement>();
  let player: Player | null = null;
  let playback = $state<Playback | null>(null);
  let audio = $state('');
  let subtitles = $state('');
  let intro = $state<Segment | null>(null);
  let notice = $state<{ text: string; takenOver: boolean } | null>(null);

  // What plays, as titles are shown everywhere: an episode with its series.
  const title = $derived.by(() => {
    if (!playback) return '';
    const it = playback.title;
    let name = it?.name ?? playback.item.name;
    if (it?.kind === 'episode' && it.series) {
      name = `${it.series.name} · ${t('item.seasonEpisodeShort', { season: it.seasonNumber ?? '?', episode: it.episodeNumber ?? '?' })} · ${name}`;
    }
    return name + (playback.method !== 'direct' ? ` · ${t(`player.method.${playback.method}` as Key)}` : '');
  });

  onMount(async () => {
    if (!video) return;
    try {
      player = await overfin.play(video, id, {
        startMs: takeStart(),
        Hls: await hls(),
        // Every (re)start: the title and the track menus.
        onStart(pb) {
          notice = null;
          playback = pb;
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

  // Leaving the screen, or the page, ends the playback.
  function close() {
    const p = player;
    player = null;
    p?.close();
  }
  onDestroy(close);

  // "Skip intro" while inside an intro.
  function timeUpdate() {
    const segment = player?.segmentAt();
    intro = segment && segment.kind === 'intro' && player!.positionMs < segment.endMs - 1000 ? segment : null;
  }

  function skipIntro() {
    if (intro && video) video.currentTime = intro.endMs / 1000;
  }
</script>

<svelte:window onpagehide={close} />

<div class="player">
  <!-- svelte-ignore a11y_media_has_caption: subtitles come from the server's tracks -->
  <video bind:this={video} controls autoplay playsinline ontimeupdate={timeUpdate}></video>
  {#if intro}
    <button class="skip" onclick={skipIntro}>{t('player.skipIntro')}</button>
  {/if}
  <div class="bar">
    <button onclick={() => history.back()}>← {t('player.back')}</button>
    <div class="title">{title}</div>
    {#if (playback?.audioTracks?.length ?? 0) > 1}
      <select aria-label={t('player.audio')} bind:value={audio} onchange={() => player?.setAudioTrack(audio)}>
        {#each playback?.audioTracks ?? [] as track (track.id)}<option value={track.id}>{track.label}</option>{/each}
      </select>
    {/if}
    {#if playback?.subtitleTracks?.length}
      <select aria-label={t('player.subtitles')} bind:value={subtitles} onchange={() => player?.setSubtitleTrack(subtitles || null)}>
        <option value="">{t('player.noSubtitles')}</option>
        {#each playback.subtitleTracks as track (track.id)}<option value={track.id}>{track.label}</option>{/each}
      </select>
    {/if}
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
