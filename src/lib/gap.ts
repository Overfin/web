// A stream that starts (or starts again) at a place its first piece begins
// just after: the video holds still at that place, before the picture,
// paused, and hls.js only steps over such gaps while it plays.

/** ranges is what the video holds, as [start, end] pairs in seconds. */
export function rangesOf(buffered: TimeRanges): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < buffered.length; i++) out.push([buffered.start(i), buffered.end(i)]);
  return out;
}

/**
 * gapEnd is where to go on from `at` when nothing held covers it but a
 * piece begins at most `most` seconds after it: that piece's start; null
 * otherwise (it's there already, or what's held is too far to skip to).
 */
export function gapEnd(ranges: [number, number][], at: number, most = 2): number | null {
  if (ranges.some(([start, end]) => start <= at && at < end)) return null;
  const next = ranges.filter(([start]) => start > at && start - at <= most).sort((a, b) => a[0] - b[0])[0];
  return next ? next[0] : null;
}
