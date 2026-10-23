// The page's look: the active profile's theme, or the device's when it has
// none. The last one is remembered in this browser, so a page opens in it
// before the profile is known.

const key = 'overfin-web-theme';

// applyTheme sets the look: "light" or "dark", else the device's.
export function applyTheme(theme: string | undefined): void {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export function rememberTheme(theme: string | undefined): void {
  try {
    if (theme) localStorage.setItem(key, theme);
    else localStorage.removeItem(key);
  } catch {
    // Not kept: the next page opens in the device's look until it knows.
  }
}

export function rememberedTheme(): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}
