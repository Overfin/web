// Pages' answers, kept for the open tab so going back, or opening a title
// whose card was hovered, shows at once. A kept answer is used as it is
// for a few minutes; older, it's shown at once and read again in the
// background for next time. A playback or a mark makes every answer old
// (pagesChanged). Each profile its own; nothing is kept beyond the tab.

/** fresh is how long a kept answer is used as it is. */
const fresh = 5 * 60_000;
/** most is how many answers are kept; the least recently used go first. */
const most = 40;

interface Entry {
  at: number;
  value: Promise<unknown>;
  done: boolean;
}

const entries = new Map<string, Entry>();
let changedAt = 0;

function keep(key: string, value: Promise<unknown>) {
  const entry: Entry = { at: Date.now(), value, done: false };
  entries.delete(key);
  entries.set(key, entry);
  value.then(() => (entry.done = true), () => entries.get(key) === entry && entries.delete(key));
  while (entries.size > most) entries.delete(entries.keys().next().value!);
}

/** cached answers read() for key: kept when fresh; kept and read again in
 * the background when old; read now otherwise. */
export function cached<T>(key: string, read: () => Promise<T>): Promise<T> {
  const entry = entries.get(key);
  if (entry) {
    entries.delete(key);
    entries.set(key, entry); // the most recently used
    const old = Date.now() - entry.at > fresh || entry.at < changedAt;
    if (!old || !entry.done) return entry.value as Promise<T>;
    const again = read();
    again.then((value) => keep(key, Promise.resolve(value)), () => {});
    return entry.value as Promise<T>;
  }
  const value = read();
  keep(key, value);
  return value;
}

/** prefetch reads key ahead, to show it at once when it's opened. */
export function prefetch<T>(key: string, read: () => Promise<T>) {
  cached(key, read).catch(() => {});
}

/** pagesChanged says something pages show changed: every kept answer is
 * read again the next time it's shown. */
export function pagesChanged() {
  changedAt = Date.now();
}

// Lists (a library's, a category's) as far as they were scrolled, kept the
// same way: used as they are while fresh and nothing changed, else read
// again from the start.
const lists = new Map<string, { at: number; state: unknown }>();

/** keptList returns a list's kept state, null when there's none or it's
 * old. */
export function keptList<T>(key: string): T | null {
  const entry = lists.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > fresh || entry.at < changedAt) {
    lists.delete(key);
    return null;
  }
  return entry.state as T;
}

/** keepList keeps a list's state (what it read, and how to read on). */
export function keepList(key: string, state: unknown) {
  const at = lists.get(key)?.at ?? Date.now();
  lists.delete(key);
  lists.set(key, { at, state });
  while (lists.size > 10) lists.delete(lists.keys().next().value!);
}
