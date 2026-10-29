// The page's backdrop: a picture fixed behind the whole page (title and
// collection pages, the home page's slideshow), under the header; the
// page's own top is see-through, the rest scrolls over it on a translucent
// sheet. PageBackdrop shows it. On a screen taller than wide (a phone), the
// title's text-free poster when it has one: a wide backdrop cut to a tall
// screen loses whatever isn't in its middle, and a poster's own text would
// show through.

export interface Backdrop {
  /** wide is the backdrop's address. */
  wide?: string;
  /** tall is the text-free poster's, for screens taller than wide. */
  tall?: string;
}

export const pageBackdrop = $state<{ current: Backdrop | null }>({ current: null });

const some = (b: Backdrop | undefined) => (b && (b.wide || b.tall) ? { ...b } : null);

// Which page's backdrop is shown: a plain marker of its own (the state
// keeps a copy of a backdrop, never the same object, so a page can't tell
// by it whether the one shown is still its own).
let owner: object | null = null;

/** backdropOf is an action making b the page's backdrop while node is
 * there (and as b changes); none when it has no picture. */
export function backdropOf(node: HTMLElement, b: Backdrop | undefined) {
  const mine = {};
  owner = mine;
  pageBackdrop.current = some(b);
  return {
    update(next: Backdrop | undefined) {
      owner = mine;
      pageBackdrop.current = some(next);
    },
    destroy() {
      // Another page may have set its own meanwhile.
      if (owner === mine) {
        owner = null;
        pageBackdrop.current = null;
      }
    },
  };
}
