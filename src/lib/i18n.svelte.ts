// Translations: every text the site shows goes through t(). The language is
// the account's, from the server; before it's known, the browser's.
import en from '../locales/en';
import fr from '../locales/fr';

export type Key = keyof typeof en;

const catalogs = { en, fr } satisfies Record<string, Record<Key, string>>;
export type Locale = keyof typeof catalogs;

function initial(): Locale {
  // A language picked on this device before the account had one is gone.
  try {
    localStorage.removeItem('overfin-web-locale');
  } catch {
    // Storage may be off.
  }
  for (const lang of globalThis.navigator?.languages ?? []) {
    const code = lang.slice(0, 2).toLowerCase();
    if (code in catalogs) return code as Locale;
  }
  return 'en';
}

const first = initial();
let current = $state<Locale>(first);
if (typeof document !== 'undefined') document.documentElement.lang = first;

export const i18n = {
  get locale(): Locale {
    return current;
  },
  set(locale: Locale) {
    current = locale;
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  },
  /** follow sets the site's language from the account's ("fr-CA"): its
   * language, when the site has texts in it, else English. */
  follow(tag: string) {
    const code = tag.slice(0, 2).toLowerCase();
    this.set(code in catalogs ? (code as Locale) : 'en');
  },
};

/** t returns the text for key in the current language, with {values}
 * filled in. A key built at runtime from a value the site doesn't know yet
 * (a new request status, say) comes back as it is, rather than breaking
 * the page. */
export function t(key: Key, values: Record<string, string | number> = {}): string {
  const text: string = catalogs[current][key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

/** has reports whether key is a known text, for keys built at runtime. */
export function has(key: string): key is Key {
  return key in en;
}

/** tn picks the singular or plural form: base + ".one" or ".other". */
export function tn(base: 'library.count' | 'discover.episodes' | 'profiles.reserved', count: number): string {
  const form = new Intl.PluralRules(current).select(count) === 'one' ? 'one' : 'other';
  return t(`${base}.${form}`, { count: count.toLocaleString(current) });
}
