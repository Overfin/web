import { describe, expect, it } from 'vitest';
import { decodePGS, parseVTT, PictureSubtitles } from './overfin.js';

describe('parseVTT', () => {
  it('reads Overfin’s WebVTT into cues, in seconds', () => {
    const vtt = 'WEBVTT\n\n00:01.500 --> 00:02.000\nHi\n\n01:02:03.250 --> 01:02:04.000\nTwo\nlines\n\n00:05.000 --> 00:06.000\n';
    expect(parseVTT(vtt)).toEqual([
      { start: 1.5, end: 2, text: 'Hi' },
      { start: 3723.25, end: 3724, text: 'Two\nlines' },
    ]);
  });
});

// A tiny PGS track: a 2×1 picture shown at startMs, the screen cleared at clearMs.
function pgs(startMs: number, clearMs: number): Uint8Array {
  const out: number[] = [];
  const seg = (ms: number, type: number, payload: number[]) => {
    const pts = Math.round(ms * 90);
    out.push(0x50, 0x47, (pts >>> 24) & 255, (pts >>> 16) & 255, (pts >>> 8) & 255, pts & 255, 0, 0, 0, 0, type,
      payload.length >> 8, payload.length & 255, ...payload);
  };
  // Presentation: 1920×1080, rate, number 1, a new epoch, palette 0, one picture (id 0, window 0) at 10,20.
  seg(startMs, 0x16, [7, 128, 4, 56, 0x10, 0, 1, 0x80, 0, 0, 1, 0, 0, 0, 0, 0, 10, 0, 20]);
  seg(startMs, 0x14, [0, 0, 1, 235, 128, 128, 255]); // palette 0: entry 1, white, opaque
  seg(startMs, 0x15, [0, 0, 0, 0xc0, 0, 0, 6, 0, 2, 0, 1, 1, 1, 0, 0]); // picture 0: 2×1, two pixels of entry 1, end of line
  seg(startMs, 0x80, []);
  // The clear: a presentation with no picture.
  seg(clearMs, 0x16, [7, 128, 4, 56, 0x10, 0, 2, 0, 0, 0, 0]);
  seg(clearMs, 0x80, []);
  return new Uint8Array(out);
}

describe('decodePGS', () => {
  it('keeps clears as cues with no picture when asked', () => {
    expect(decodePGS(pgs(1000, 3000)).map((c) => [c.startMs, c.endMs, c.pictures.length])).toEqual([[1000, 3000, 1]]);
    expect(decodePGS(pgs(1000, 3000), { clears: true }).map((c) => [c.startMs, c.endMs, c.pictures.length]))
      .toEqual([[1000, 3000, 1], [3000, Infinity, 0]]);
  });
});

describe('PictureSubtitles stretches', () => {
  const subs = () => new PictureSubtitles({ currentTime: 0 } as HTMLVideoElement, { style: {} } as HTMLCanvasElement);
  const cue = (startMs: number, n: number) => ({ startMs, endMs: Infinity, width: 1, height: 1, forced: false, pictures: Array(n).fill({}) });

  it('merges overlapping stretches, each cue lasting until the next', () => {
    const s = subs();
    // Stretch 0 ends with a line still on screen: its clear is in stretch 1.
    s.add([cue(100, 1), cue(200, 0), cue(300, 1)]);
    // Stretch 1 starts early: the line at 300 again, then its clear.
    s.add([cue(300, 1), cue(400, 0), cue(500, 1)]);
    expect(s.cues.map((c) => [c.startMs, c.endMs, c.pictures.length])).toEqual([
      [100, 200, 1], [200, 300, 0], [300, 400, 1], [400, 500, 0], [500, Infinity, 1],
    ]);
  });
});
