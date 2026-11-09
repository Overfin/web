// Whether the site runs on a TV, driven by a remote: its browser says so
// (Samsung, LG, Sony, Fire TV, Google TV, or Overfin's own TV app), or the
// address asked for it (?tv=1, kept in the browser; ?tv=0 forgets it), to
// try a TV's ways on a computer. Only what a remote can't do otherwise
// changes with it (the player's keys).

const tvBrowsers = /SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|HbbTV|AFT[A-Z]|GoogleTV|Android TV|AndroidTV|OverfinTV/i;
const key = 'overfin-web-tv';

function asked(): boolean {
  try {
    const wanted = new URLSearchParams(location.search).get('tv');
    if (wanted === '1') localStorage.setItem(key, '1');
    else if (wanted === '0') localStorage.removeItem(key);
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export const onTV = typeof navigator !== 'undefined' && (tvBrowsers.test(navigator.userAgent) || asked());
