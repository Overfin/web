import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, keepList, keptList, pagesChanged } from './pagecache';

let n = 0;
const key = () => `test:${++n}`;
const settle = () => new Promise((resolve) => setTimeout(resolve));
// Each test an hour after the last, so their changes don't meet.
let now = Date.now();

describe('page cache', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime((now += 3_600_000));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps an answer while it is fresh', async () => {
    const k = key();
    const read = vi.fn(async () => 1);
    expect(await cached(k, read)).toBe(1);
    expect(await cached(k, read)).toBe(1);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('shows an old answer at once and reads it again for next time', async () => {
    const k = key();
    let value = 1;
    const read = vi.fn(async () => value);
    await cached(k, read);
    vi.setSystemTime(Date.now() + 6 * 60_000);
    value = 2;
    expect(await cached(k, read)).toBe(1);
    await settle();
    expect(await cached(k, read)).toBe(2);
  });

  it('reads again before showing after a playback or a mark', async () => {
    const k = key();
    let value = 1;
    await cached(k, async () => value);
    vi.setSystemTime(Date.now() + 1000);
    pagesChanged();
    value = 2;
    expect(await cached(k, async () => value)).toBe(2);
  });

  it('counts a background read as of when it was asked', async () => {
    const k = key();
    await cached(k, async () => 1);
    vi.setSystemTime(Date.now() + 6 * 60_000);
    let answer!: (v: number) => void;
    cached(k, () => new Promise<number>((resolve) => (answer = resolve)));
    vi.setSystemTime(Date.now() + 1000);
    pagesChanged(); // while the background read is on its way
    vi.setSystemTime(Date.now() + 1000);
    answer(2);
    await settle();
    expect(await cached(k, async () => 3)).toBe(3);
  });

  it('drops a kept list after a change', () => {
    const k = key();
    keepList(k, { items: [1] });
    expect(keptList(k)).toEqual({ items: [1] });
    vi.setSystemTime(Date.now() + 1000);
    pagesChanged();
    expect(keptList(k)).toBeNull();
  });
});
