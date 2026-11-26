import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeError extends Error {
  constructor(public type: string, public problem: { stepUpUrl?: string } = {}) {
    super(type);
  }
}
const stepUps: unknown[] = [];
let pinAnswer: string | null = '1234';
const pinLabels: string[] = [];
vi.mock('./client', () => ({
  overfin: { stepUp: (e: unknown) => stepUps.push(e) },
  isError: (e: unknown, type: string) => e instanceof FakeError && e.type === type,
  explain: (e: unknown) => (e instanceof FakeError ? `explained ${e.type}` : 'generic'),
}));
vi.mock('./dialog.svelte', () => ({ askPin: async (label: string) => (pinLabels.push(label), pinAnswer) }));
vi.mock('./i18n.svelte', () => ({ t: (k: string) => k }));

const { confirmed } = await import('./confirmed');

describe('an action the server may want confirmed', () => {
  beforeEach(() => {
    stepUps.length = 0;
    pinLabels.length = 0;
    pinAnswer = '1234';
  });

  it('goes through at once when nothing is asked', async () => {
    const fails: string[] = [];
    expect(await confirmed(async () => 'ok', (m) => fails.push(m))).toBe(true);
    expect(fails).toEqual(['']);
  });

  it('sends the browser to a fresh login when one is asked, and stops', async () => {
    const err = new FakeError('step-up-required', { stepUpUrl: '/api/v1/step-up' });
    expect(await confirmed(async () => { throw err; }, () => {})).toBe(false);
    expect(stepUps).toEqual([err]);
  });

  it("explains a fresh login it can't get here", async () => {
    const fails: string[] = [];
    expect(await confirmed(async () => { throw new FakeError('step-up-required'); }, (m) => fails.push(m))).toBe(false);
    expect(stepUps).toEqual([]);
    expect(fails.at(-1)).toBe('explained step-up-required');
  });

  it('asks the PIN and runs again with it', async () => {
    const pins: (string | undefined)[] = [];
    const ok = await confirmed(async (pin) => {
      pins.push(pin);
      if (!pin) throw new FakeError('pin-required');
    }, () => {}, 'Owner PIN');
    expect(ok).toBe(true);
    expect(pins).toEqual([undefined, '1234']);
    expect(pinLabels).toEqual(['Owner PIN']);
  });

  it('explains a wrong PIN (the server says pin-incorrect) and stops', async () => {
    const fails: string[] = [];
    const ok = await confirmed(async (pin) => {
      throw new FakeError(pin ? 'pin-incorrect' : 'pin-required');
    }, (m) => fails.push(m));
    expect(ok).toBe(false);
    expect(fails.at(-1)).toBe('explained pin-incorrect');
    expect(pinLabels).toHaveLength(1);
  });

  it('stops when the PIN is not given', async () => {
    pinAnswer = null;
    expect(await confirmed(async () => { throw new FakeError('pin-required'); }, () => {})).toBe(false);
  });

  it('explains any other failure', async () => {
    const fails: string[] = [];
    expect(await confirmed(async () => { throw new FakeError('owner-only'); }, (m) => fails.push(m))).toBe(false);
    expect(fails).toEqual(['', 'explained owner-only']);
  });
});
