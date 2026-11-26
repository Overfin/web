import { describe, expect, it, vi } from 'vitest';

const went: [string, string][] = [];
vi.mock('./router.svelte', () => ({ go: (p: string) => went.push(['go', p]), replace: (p: string) => went.push(['replace', p]) }));
vi.mock('./paths', () => ({ playPath: (id: string) => `/play/${id}` }));
const { play, playInstead, takeStart } = await import('./play');

describe('where the next playback starts', () => {
  it('is the chosen start, taken once', () => {
    play('m1', 60_000);
    expect(went.at(-1)).toEqual(['go', '/play/m1']);
    expect(takeStart()).toBe(60_000);
    expect(takeStart()).toBeUndefined();
  });

  it('is none when nothing was chosen (resume where the profile left off)', () => {
    play('m1', 5);
    play('m2');
    expect(takeStart()).toBeUndefined();
  });

  it("replaces the player's place for the next episode, from 0 too", () => {
    playInstead('e2', 0);
    expect(went.at(-1)).toEqual(['replace', '/play/e2']);
    expect(takeStart()).toBe(0);
  });
});
