// The page's backdrop: a picture fixed behind the whole page (title and
// collection pages, the home page's slideshow), under the header; the
// page's own top is see-through, the rest scrolls over it on a translucent
// sheet. PageBackdrop shows it.

export const pageBackdrop = $state<{ url: string | null }>({ url: null });

/** backdropOf is an action making url the page's backdrop while node is
 * there (and as url changes); none when url is empty. */
export function backdropOf(node: HTMLElement, url: string | undefined) {
  let mine = url || null;
  pageBackdrop.url = mine;
  return {
    update(next: string | undefined) {
      mine = next || null;
      pageBackdrop.url = mine;
    },
    destroy() {
      // Another page may have set its own meanwhile.
      if (pageBackdrop.url === mine) pageBackdrop.url = null;
    },
  };
}
