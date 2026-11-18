// Translations: every text the site shows goes through t(). The language is
// the account's, from the server; before it's known, the browser's.
import en from '../locales/en';
import fr from '../locales/fr';
import { setLanguage as kitLanguage } from '@overfin/ui';

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
// Dates and numbers follow the account's language with its region ("fr-CA"),
// not the browser's: a French account on an English browser reads French.
let region = $state<string>(first);
if (typeof document !== 'undefined') document.documentElement.lang = first;

export const i18n = {
  get locale(): Locale {
    return current;
  },
  /** formats is the locale dates and numbers are written in. */
  get formats(): string {
    return region;
  },
  set(locale: Locale) {
    current = locale;
    region = locale;
    kitLanguage(locale); // the kit's own few words (its "?", say)
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  },
  /** follow sets the site's language from the account's ("fr-CA"): its
   * language, when the site has texts in it, else English. */
  follow(tag: string) {
    const code = tag.slice(0, 2).toLowerCase();
    this.set(code in catalogs ? (code as Locale) : 'en');
    // The region too, when it's a tag Intl knows and in the same language.
    try {
      if (code in catalogs && Intl.DateTimeFormat.supportedLocalesOf([tag]).length) region = tag;
    } catch {
      // Not a valid tag: the language alone.
    }
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
/** date writes a date (a Date or an ISO string) in the site's language. */
export function date(d: Date | string, style: 'medium' | 'long' = 'medium'): string {
  return (typeof d === 'string' ? new Date(d) : d).toLocaleDateString(region, { dateStyle: style });
}

/** timeOfDay writes a time of day (20:57, 8:57 PM) as the site's region does. */
export function timeOfDay(d: Date): string {
  return d.toLocaleTimeString(region, { hour: 'numeric', minute: '2-digit' });
}

/** listParts joins items as the site's language does ("A, B and C"),
 * in parts: each item (by its index) and the words between, so that an
 * item may be drawn as something else (a button). Items must not be
 * empty: Intl leaves an empty one out. */
export function listParts(items: string[]): ({ item: number } | { text: string })[] {
  let at = 0;
  return new Intl.ListFormat(region, { type: 'conjunction' }).formatToParts(items).map((p) =>
    p.type === 'element' ? { item: at++ } : { text: p.value });
}

/** num writes a number in the site's language. */
export function num(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(region, options);
}

export function tn(base: 'library.count' | 'manage.limitReserved' | 'manage.moreDevices' | 'title.moreSources' | 'title.moreSourcesLabel', count: number): string {
  const form = new Intl.PluralRules(current).select(count) === 'one' ? 'one' : 'other';
  return t(`${base}.${form}`, { count: count.toLocaleString(region) });
}
