// Moving with the arrows, as a TV's remote does: once something has the
// focus, an arrow gives it to the nearest item that way. Left and right go
// along a row (scrolling it), up and down to the row above or below, the
// item nearest across. With nothing focused the arrows scroll the page as
// usual (on a TV, they start on the first item on the screen); in a text
// field, a list or a slider they do what they do there;
// a part that handles them itself (the seasons, the slideshow, the player)
// keeps them. Inside an open menu or window, only its items are reached;
// what Tab skips (tabindex -1: a row's arrows, the seasons but the chosen
// one) or what's in data-arrows="skip" (the slideshow's own arrows, an
// episode's marks) never is.

import { onTV } from './tv';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const across = (a: Box, b: Box, horizontal: boolean) =>
  horizontal ? a.top < b.bottom && a.bottom > b.top : a.left < b.right && a.right > b.left;

const middle = (b: Box, horizontal: boolean) => (horizontal ? (b.top + b.bottom) / 2 : (b.left + b.right) / 2);

// gap is how far a box is from the current one that way: below 0, it isn't
// that way at all (a few pixels' overlap allowed).
function gap(from: Box, to: Box, direction: Direction) {
  switch (direction) {
    case 'right': return to.left - from.right;
    case 'left': return from.left - to.right;
    case 'down': return to.top - from.bottom;
    case 'up': return from.top - to.bottom;
  }
}

/** pick is the box an arrow goes to from another, or -1 for none. */
export function pick(from: Box, direction: Direction, boxes: Box[]): number {
  const horizontal = direction === 'left' || direction === 'right';
  const ahead = boxes.map((b, i) => ({ b, i, gap: gap(from, b, direction) })).filter((c) => c.gap >= -4);
  if (!ahead.length) return -1;
  if (horizontal) {
    // Along the same row, the nearest; at its end, nowhere: another row's
    // card off the screen, or the menu bar, isn't where right leads.
    const row = ahead.filter((c) => across(c.b, from, true));
    if (!row.length) return -1;
    return row.reduce((best, c) => (c.gap < best.gap ? c : best)).i;
  }
  // The nearest row that way, then its item nearest across.
  const nearest = ahead.reduce((best, c) => (c.gap < best.gap ? c : best));
  const row = ahead.filter((c) => across(c.b, nearest.b, true));
  const off = (c: (typeof ahead)[number]) => Math.abs(middle(c.b, false) - middle(from, false));
  return row.reduce((best, c) => (off(c) < off(best) || (off(c) === off(best) && c.gap < best.gap) ? c : best)).i;
}

// An item drawn over a bigger one (a card's play button over its poster) is
// left to Tab: the arrows go to the bigger one.
function onTop(box: Box, others: Box[]) {
  const x = (box.left + box.right) / 2;
  const y = (box.top + box.bottom) / 2;
  const area = (box.right - box.left) * (box.bottom - box.top);
  return others.some((o) => o !== box && (o.right - o.left) * (o.bottom - o.top) > area && x > o.left && x < o.right && y > o.top && y < o.bottom);
}

// keepsArrows says whether a field uses this arrow itself. On a TV, where
// the arrows are the only way out, a list (OK opens it) keeps none, and a
// text field only left and right.
function keepsArrows(element: Element, direction: Direction) {
  const across = direction === 'left' || direction === 'right';
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return !onTV;
  if (element instanceof HTMLInputElement) {
    if (['button', 'submit', 'reset', 'checkbox', 'radio', 'image'].includes(element.type)) return false;
    return !onTV || across;
  }
  return (element as HTMLElement).isContentEditable;
}

// firstItem gives a TV's remote somewhere to start: with nothing focused
// (the page just changed), the first item on the screen, the page's own
// before the menu bar's.
function firstItem(): HTMLElement | undefined {
  const scope = document.querySelector('dialog[open]') ?? document;
  const items = [...scope.querySelectorAll<HTMLElement>(focusable)].filter(usable);
  const boxes = items.map((e) => e.getBoundingClientRect());
  const inView = items.filter((_, i) => {
    const b = boxes[i];
    return b.right > b.left && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth && !onTop(b, boxes);
  });
  return inView.find((e) => !e.closest('header')) ?? inView[0];
}

const usable = (e: HTMLElement) => !e.closest('[inert]') && !e.closest('[data-arrows=skip]') && e.tabIndex >= 0 && getComputedStyle(e).visibility !== 'hidden';

/** arrows handles an arrow key for the page: true when it moved the focus. */
export function arrows(event: KeyboardEvent): boolean {
  const direction = directions[event.key];
  if (!direction || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const current = document.activeElement;
  if (!current || current === document.body) {
    if (!onTV) return false;
    const first = firstItem();
    if (!first) return false;
    event.preventDefault();
    first.focus({ preventScroll: true });
    return true;
  }
  if (keepsArrows(current, direction)) return false;
  const scope = current.closest('dialog[open], [role=dialog], .dropdown') ?? document;
  const elements = [...scope.querySelectorAll<HTMLElement>(focusable)].filter((e) => e !== current && usable(e));
  // The menu bar stays on top of the screen while the page scrolls: it's
  // taken where it belongs, at the page's top, so up reaches what's above
  // first.
  const placed = (e: Element): Box => {
    const b = e.getBoundingClientRect();
    if (!e.closest('header')) return b;
    return { left: b.left, right: b.right, top: b.top - scrollY, bottom: b.bottom - scrollY };
  };
  const boxes = elements.map(placed);
  const shown = elements.map((e, i) => ({ e, b: boxes[i] })).filter(({ b }) => b.right > b.left && b.bottom > b.top);
  const reachable = shown.filter(({ b }) => !onTop(b, boxes));
  const to = pick(placed(current), direction, reachable.map(({ b }) => b));
  // Nothing that way: the page scrolls as it would (its top, its end).
  if (to < 0) return false;
  event.preventDefault();
  const target = reachable[to].e;
  target.focus({ preventScroll: true });
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = smooth ? 'smooth' : 'auto';
  // Along a row, it scrolls only as far as needed.
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior });
  // In a menu or a window, the page behind stays where it is.
  if (direction === 'left' || direction === 'right' || scope !== document) return true;
  // Up and down: an item the first screen has brings the page back to its
  // top (the slideshow whole); one already in full view stays where it is;
  // any other comes to the middle, with what's around it.
  const box = target.getBoundingClientRect();
  const under = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
  if (box.bottom + scrollY <= innerHeight) window.scrollTo({ top: 0, behavior });
  else if (box.top < under || box.bottom > innerHeight) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
  return true;
}
