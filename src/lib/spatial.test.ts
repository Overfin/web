import { describe, expect, it } from 'vitest';
import { pick, type Box } from './spatial';

const box = (left: number, top: number, width = 100, height = 150): Box => ({ left, top, right: left + width, bottom: top + height });

// Two rows of cards, the second shifted, and a button far below.
const rowA = [box(0, 0), box(120, 0), box(240, 0), box(360, 0)];
const rowB = [box(60, 300), box(180, 300), box(300, 300)];
const far = box(0, 900, 200, 40);
const all = [...rowA, ...rowB, far];

describe('pick', () => {
  it('goes along a row to the nearest card', () => {
    expect(pick(rowA[1], 'right', all)).toBe(2);
    expect(pick(rowA[1], 'left', all)).toBe(0);
    expect(pick(rowA[3], 'right', all)).toBe(-1);
  });

  it('goes to the next row down, to its card nearest across', () => {
    expect(pick(rowA[2], 'down', all)).toBe(5); // 240..340 → 180..280 or 300..400: 180 is nearer by centre
    expect(pick(rowA[3], 'down', all)).toBe(6);
    expect(pick(rowB[0], 'up', all)).toBe(0);
  });

  it('never skips a row for a card straight below in the one after', () => {
    // From the first row's far right, the second row's last card, not the button far below.
    expect(pick(box(600, 0), 'down', all)).toBe(6);
  });

  it('reaches what is past the last row', () => {
    expect(pick(rowB[0], 'down', all)).toBe(7);
    expect(pick(far, 'down', all)).toBe(-1);
  });

  it('goes sideways to the nearest thing when nothing is level with it', () => {
    const lone = box(0, 1000, 50, 50);
    const above = box(300, 600, 50, 50);
    expect(pick(lone, 'right', [above])).toBe(0);
  });
});
