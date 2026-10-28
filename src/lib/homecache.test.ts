import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeChanged, keepHome, keptHome } from './homecache';

describe('home kept in the tab', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('is each profile its own', () => {
    keepHome('a', 1);
    expect(keptHome('a')).toEqual({ data: 1, old: false });
    expect(keptHome('b')).toBeNull();
  });

  it('is old after a change, until read again', () => {
    keepHome('a', 1);
    homeChanged();
    expect(keptHome('a')?.old).toBe(true);
    vi.setSystemTime(Date.now() + 10);
    keepHome('a', 2);
    expect(keptHome('a')).toEqual({ data: 2, old: false });
  });

  it('stays old when the change came while it was read', () => {
    const asked = Date.now();
    vi.setSystemTime(asked + 10);
    homeChanged(); // a title taken out of Continue Watching meanwhile
    vi.setSystemTime(asked + 20);
    keepHome('a', 1, asked);
    expect(keptHome('a')?.old).toBe(true);
  });

  it('is old after five minutes', () => {
    vi.setSystemTime(Date.now() + 60_000);
    keepHome('a', 1);
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    expect(keptHome('a')?.old).toBe(true);
  });
});
