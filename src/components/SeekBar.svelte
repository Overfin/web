<!-- The player's seek bar: what's played, what's loaded, and, under the
     pointer, the time there with its preview picture (when the server has
     previews). Dragging seeks once let go, so the stream isn't asked for
     every point on the way. The keyboard doesn't move it: the player's
     arrows always seek, whatever has the focus. -->
<script lang="ts">
  import type { Trickplay } from '../lib/sdk/overfin.js';
  import { clock } from '../lib/format';
  import { t } from '../lib/i18n.svelte';

  let { positionMs, durationMs, bufferedMs, trickplay, seek, scrubbing = $bindable(false) }: {
    positionMs: number;
    durationMs: number;
    bufferedMs: number;
    trickplay?: Trickplay;
    seek: (ms: number) => void;
    scrubbing?: boolean;
  } = $props();

  let bar = $state<HTMLDivElement>();
  // Where the pointer is over the bar, as a share of it; null when it isn't.
  let hover = $state<number | null>(null);
  let dragged = $state(0);

  const share = (ms: number) => (durationMs > 0 ? Math.min(1, Math.max(0, ms / durationMs)) : 0);
  const played = $derived(scrubbing ? dragged : share(positionMs));
  const at = $derived(hover ?? (scrubbing ? dragged : null));

  function shareAt(event: PointerEvent): number {
    const r = bar!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - r.left) / r.width));
  }
  function down(event: PointerEvent) {
    if (!durationMs || event.button !== 0) return;
    bar!.setPointerCapture(event.pointerId);
    scrubbing = true;
    dragged = shareAt(event);
  }
  function move(event: PointerEvent) {
    hover = shareAt(event);
    if (scrubbing) dragged = hover;
  }
  function up(event: PointerEvent) {
    if (!scrubbing) return;
    scrubbing = false;
    seek(shareAt(event) * durationMs);
    if (event.pointerType !== 'mouse') hover = null;
  }

  // The preview at a share of the video: its sheet, and where the tile is
  // on it, shown 192 pixels wide.
  const width = 192;
  const preview = $derived.by(() => {
    if (at === null || !trickplay || !trickplay.sheets.length) return null;
    const tp = trickplay;
    const n = Math.min(tp.tileCount - 1, Math.floor((at * durationMs) / tp.intervalMs));
    const perSheet = tp.columns * tp.rows;
    const sheet = tp.sheets[Math.floor(n / perSheet)];
    if (!sheet) return null;
    const scale = width / tp.tileWidth;
    const i = n % perSheet;
    return {
      url: sheet,
      height: Math.round(tp.tileHeight * scale),
      size: `${tp.columns * width}px ${Math.round(tp.rows * tp.tileHeight * scale)}px`,
      position: `${-(i % tp.columns) * width}px ${-Math.floor(i / tp.columns) * Math.round(tp.tileHeight * scale)}px`,
    };
  });
</script>

<div class="seekbar" bind:this={bar} role="slider" tabindex="-1" aria-label={t('player.position')}
  aria-valuemin={0} aria-valuemax={Math.round(durationMs / 1000)} aria-valuenow={Math.round(positionMs / 1000)}
  aria-valuetext={clock(positionMs)}
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => (scrubbing = false)}
  onpointerleave={() => { if (!scrubbing) hover = null; }}>
  <div class="track">
    <div class="buffered" style:width="{share(bufferedMs) * 100}%"></div>
    <div class="played" style:width="{played * 100}%"></div>
    <div class="thumb" style:left="{played * 100}%"></div>
  </div>
  {#if at !== null && durationMs}
    <div class="peek" style:left="clamp({width / 2}px, {at * 100}%, calc(100% - {width / 2}px))">
      {#if preview}
        <div class="picture" style:width="{width}px" style:height="{preview.height}px"
          style:background-image="url({preview.url})" style:background-size={preview.size}
          style:background-position={preview.position}></div>
      {/if}
      <span class="time">{clock(at * durationMs)}</span>
    </div>
  {/if}
</div>

<style>
  .seekbar { position: relative; height: 1.75rem; display: flex; align-items: center; cursor: pointer; touch-action: none; }
  .track { position: relative; width: 100%; height: 4px; background: rgba(255, 255, 255, .25); border-radius: 2px; transition: height .1s; }
  .seekbar:hover .track { height: 6px; }
  .buffered, .played { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; }
  .buffered { background: rgba(255, 255, 255, .4); }
  .played { background: var(--accent); }
  .thumb {
    position: absolute; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px;
    border-radius: 50%; background: var(--accent); transform: scale(0); transition: transform .1s;
  }
  .seekbar:hover .thumb { transform: scale(1); }
  .peek {
    position: absolute; bottom: 2rem; transform: translateX(-50%); pointer-events: none;
    display: flex; flex-direction: column; align-items: center;
  }
  .picture { border: 2px solid rgba(255, 255, 255, .85); border-radius: 6px; background-color: #000; background-repeat: no-repeat; margin-bottom: .3rem; }
  .time { background: rgba(0, 0, 0, .75); padding: .1rem .45rem; border-radius: 4px; font-size: .85rem; font-variant-numeric: tabular-nums; }
</style>
