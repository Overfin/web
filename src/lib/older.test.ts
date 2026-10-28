import { afterEach, describe, expect, it } from 'vitest';
import { addMissing } from './older';

// As a browser without them would run: the site's own versions in their
// place.
describe('older browsers', () => {
  const strings = String.prototype as any;
  const own = { replaceAll: strings.replaceAll, structuredClone: (globalThis as any).structuredClone };
  afterEach(() => {
    strings.replaceAll = own.replaceAll;
    (globalThis as any).structuredClone = own.structuredClone;
  });

  it('replaces every match', () => {
    delete strings.replaceAll;
    addMissing();
    expect(strings.replaceAll).not.toBe(own.replaceAll);
    expect('<!>a<!>'.replaceAll('<!>', '<!---->')).toBe('<!---->a<!---->');
    expect('a.b.c'.replaceAll('.', '$&$&')).toBe('a..b..c');
    expect('x+x+'.replaceAll('x+', (m: string) => m.toUpperCase())).toBe('X+X+');
    expect('/* a */b/* c */'.replaceAll(/\/\*.*?\*\//g, '')).toBe('b');
    expect(() => 'a'.replaceAll(/a/ as any, 'b')).toThrow(TypeError);
  });

  it('copies dates and data', () => {
    delete (globalThis as any).structuredClone;
    addMissing();
    const when = new Date(5);
    const copy = (globalThis as any).structuredClone(when);
    expect(copy).not.toBe(when);
    expect(copy.getTime()).toBe(5);
    expect((globalThis as any).structuredClone({ a: [1, 'b'] })).toEqual({ a: [1, 'b'] });
  });
});
