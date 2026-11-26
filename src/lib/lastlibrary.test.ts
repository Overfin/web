import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastLibraryId, lastSort, librariesHref, rememberLibrary, rememberSort } from './lastlibrary';

function fakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
    clear: () => items.clear(),
  };
}

describe('the library and sort this browser remembers', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  const libs = [{ id: 'lib_a' }, { id: 'lib_b' }];

  it('opens the last library shown, else the first', () => {
    expect(lastLibraryId(libs)).toBe('lib_a');
    rememberLibrary('lib_b');
    expect(lastLibraryId(libs)).toBe('lib_b');
    expect(librariesHref(libs)).toBe('/library/lib_b');
  });

  it('falls back to the first when the remembered one is gone', () => {
    rememberLibrary('lib_gone');
    expect(lastLibraryId(libs)).toBe('lib_a');
    expect(lastLibraryId([])).toBeUndefined();
    expect(librariesHref([])).toBeUndefined();
  });

  it('keeps each profile its own sort, none without a profile', () => {
    rememberSort('p1', 'added');
    rememberSort('p2', 'year');
    rememberSort(undefined, 'name');
    expect(lastSort('p1')).toBe('added');
    expect(lastSort('p2')).toBe('year');
    expect(lastSort(undefined)).toBeUndefined();
    expect(lastSort('p3')).toBeUndefined();
  });

  it('survives what was saved being damaged, or no storage at all', () => {
    localStorage.setItem('overfin-web-sort', '{not json');
    expect(lastSort('p1')).toBeUndefined();
    rememberSort('p1', 'added');
    expect(lastSort('p1')).toBe('added');
    localStorage.setItem('overfin-web-sort', 'null');
    expect(lastSort('p1')).toBeUndefined();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => rememberLibrary('lib_b')).not.toThrow();
    expect(lastLibraryId(libs)).toBe('lib_a');
    expect(() => rememberSort('p1', 'x')).not.toThrow();
    expect(lastSort('p1')).toBeUndefined();
  });
});
