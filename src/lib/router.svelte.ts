// Every screen has a real address (/item/123, /library/abc?sort=name), so a
// reload, a bookmark or a shared link comes back to it, through the login if
// need be. Links to the site's own pages change the address without
// reloading; the gateway answers those paths with this app.
export interface Route {
  /** The path's parts: /item/123 is ["item", "123"]. */
  parts: string[];
  params: URLSearchParams;
}

function parse(): Route {
  return {
    parts: location.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part)),
    params: new URLSearchParams(location.search),
  };
}

let current = $state<Route>(parse());
// The app puts pages back where they were itself (the browser's own
// restoring would come before the page is drawn).
history.scrollRestoration = 'manual';
// Where the page was scrolled, kept with each history entry, for Back and
// Forward to come back to it.
let scrollBack: number | null = null;
// Kept as the page is scrolled too, once it stops (a moment after, so as
// not to rewrite the history entry all the time): Back, then Forward, comes
// back to where it was.
let scrolled: ReturnType<typeof setTimeout> | undefined;
window.addEventListener('scroll', () => {
  clearTimeout(scrolled);
  scrolled = setTimeout(keepScroll, 300);
}, { passive: true });
window.addEventListener('popstate', () => {
  clearTimeout(scrolled);
  scrollBack = typeof history.state?.y === 'number' ? history.state.y : null;
  current = parse();
});

/** takeScroll is where to scroll the page just shown: where it was left,
 * after Back or Forward; null for the top. */
export function takeScroll(): number | null {
  const y = scrollBack;
  scrollBack = null;
  return y;
}

/** keepScroll keeps where the current page is scrolled, in its history
 * entry. */
function keepScroll() {
  history.replaceState({ ...history.state, y: window.scrollY }, '');
}

export const router = {
  get route(): Route {
    return current;
  },
};

// Each entry the app adds to the history counts how many of the site's own
// come before it, so Back can tell whether it stays on the site.
function depth(): number {
  return typeof history.state?.depth === 'number' ? history.state.depth : 0;
}

/** go shows another screen, adding it to the history. */
export function go(path: string) {
  if (path === location.pathname + location.search) return;
  clearTimeout(scrolled);
  keepScroll();
  history.pushState({ depth: depth() + 1 }, '', path);
  current = parse();
}

/** replace changes the address without a new history entry. */
export function replace(path: string) {
  clearTimeout(scrolled);
  history.replaceState({ depth: depth() }, '', path);
  current = parse();
}

/** canGoBack says whether Back leads to one of the site's own screens. */
export function canGoBack(): boolean {
  return depth() > 0;
}

// Clicks on links to the site's own pages stay in the app. Anything else (a
// new tab, a download, another site, the API) is left to the browser.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest?.('a');
  if (!link || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  event.preventDefault();
  go(url.pathname + url.search);
});
