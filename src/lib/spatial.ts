// Moving with the arrows, as a TV's remote does: once something has the
// focus, an arrow gives it to the nearest item that way. Left and right go
// along a row (scrolling it), up and down to the row above or below, the
// item nearest across. With nothing focused the arrows scroll the page as
// usual; in a text field, a list or a slider they do what they do there;
// a part that handles them itself (the seasons, the slideshow, the player)
// keeps them. Inside an open menu or window, only its items are reached;
// what Tab skips (tabindex -1: a row's arrows, the seasons but the chosen
// one) or what's in data-arrows="skip" (the slideshow's own arrows, an
// episode's marks) never is.

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
    // Along the same row first, the nearest; else whatever is nearest.
    const row = ahead.filter((c) => across(c.b, from, true));
    const pool = row.length ? row : ahead;
    const score = (c: (typeof ahead)[number]) => c.gap + (row.length ? 0 : 2 * Math.abs(middle(c.b, true) - middle(from, true)));
    return pool.reduce((best, c) => (score(c) < score(best) ? c : best)).i;
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

function keepsArrows(element: Element) {
  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return !['button', 'submit', 'reset', 'checkbox', 'radio', 'image'].includes(element.type);
  return (element as HTMLElement).isContentEditable;
}

/** arrows handles an arrow key for the page: true when it moved the focus. */
export function arrows(event: KeyboardEvent): boolean {
  const direction = directions[event.key];
  if (!direction || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  const current = document.activeElement;
  if (!current || current === document.body || keepsArrows(current)) return false;
  const scope = current.closest('dialog[open], [role=dialog], .dropdown') ?? document;
  const elements = [...scope.querySelectorAll<HTMLElement>(focusable)].filter((e) => e !== current && !e.closest('[inert]') && !e.closest('[data-arrows=skip]') && e.tabIndex >= 0);
  // The menu bar stays on top of the screen while the page scrolls: it's
  // taken where it belongs, at the page's top, so up reaches what's above
  // first.
  const placed = (e: Element): Box => {
    const b = e.getBoundingClientRect();
    if (!e.closest('header')) return b;
    return { left: b.left, right: b.right, top: b.top - scrollY, bottom: b.bottom - scrollY };
  };
  const boxes = elements.map(placed);
  const shown = elements.map((e, i) => ({ e, b: boxes[i] })).filter(({ e, b }) => b.right > b.left && b.bottom > b.top && getComputedStyle(e).visibility !== 'hidden');
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
  if (direction === 'left' || direction === 'right') return true;
  // Up and down: an item the first screen has brings the page back to its
  // top (the slideshow whole); one already in full view stays where it is;
  // any other comes to the middle, with what's around it.
  const box = target.getBoundingClientRect();
  const under = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
  if (box.bottom + scrollY <= innerHeight) window.scrollTo({ top: 0, behavior });
  else if (box.top < under || box.bottom > innerHeight) target.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
  return true;
}
