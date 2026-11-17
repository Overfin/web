import { describe, expect, it } from 'vitest';
import { gapEnd } from './gap';

describe('gapEnd', () => {
  it('steps over a short gap before what the video holds', () => {
    // Asked to start at 83.4 s, the stream's first piece begins at 83.8 s.
    expect(gapEnd([[83.8, 120]], 83.4)).toBe(83.8);
  });
  it('leaves a place the video holds where it is', () => {
    expect(gapEnd([[80, 120]], 83.4)).toBeNull();
    expect(gapEnd([[0, 10], [83.8, 120]], 5)).toBeNull();
  });
  it('never skips far, nor back', () => {
    expect(gapEnd([[90, 120]], 83.4)).toBeNull();
    expect(gapEnd([[0, 83]], 83.4)).toBeNull();
    expect(gapEnd([], 0)).toBeNull();
  });
  it('takes the nearest piece ahead', () => {
    expect(gapEnd([[85, 90], [84, 84.5]], 83.4)).toBe(84);
  });
});
