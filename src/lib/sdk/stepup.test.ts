import { afterEach, describe, expect, it, vi } from 'vitest';
import { Overfin } from './overfin.js';

describe('stepUp', () => {
  afterEach(() => vi.unstubAllGlobals());
  const at = () => {
    const loc = { origin: 'https://media.example.org', pathname: '/title/m1', search: '', hash: '', href: '' };
    vi.stubGlobal('location', loc);
    return loc;
  };
  const err = (stepUpUrl: string) => ({ problem: { stepUpUrl } });

  it('goes to this site’s step-up page, with where to come back', () => {
    const loc = at();
    new Overfin().stepUp(err('/api/v1/step-up'), '/account');
    expect(loc.href).toBe('https://media.example.org/api/v1/step-up?return=%2Faccount');
  });

  it('never leaves the site', () => {
    at();
    for (const url of ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)']) {
      expect(() => new Overfin().stepUp(err(url))).toThrow();
    }
  });
});
