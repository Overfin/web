// An action giving the tab the page's heading, then the site's name ("Inception
// · My server"), so history, tabs and bookmarks tell pages apart. It follows
// the page's h1 as it's drawn and changes (its text, or a logo's alt); a page
// without one, like home, is the site's name alone.
export function tabTitle(main: HTMLElement, site: string) {
  const update = () => {
    const h1 = main.querySelector('h1');
    const page = h1 ? (h1.querySelector('img')?.alt || h1.textContent || '').trim() : '';
    const next = page && page !== site ? `${page} · ${site}` : site;
    if (document.title !== next) document.title = next;
  };
  const observer = new MutationObserver(update);
  observer.observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['alt'] });
  update();
  return {
    update(next: string) {
      site = next;
      update();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
