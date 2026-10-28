// The library this browser last showed: the header's Libraries item opens
// it, else the first one.

const key = 'overfin-web-library';

export function rememberLibrary(id: string): void {
  try {
    localStorage.setItem(key, id);
  } catch {
    // Not kept: the first library opens.
  }
}

// lastLibraryId is the library the Libraries item opens.
export function lastLibraryId(libraries: { id: string }[]): string | undefined {
  let last: string | null = null;
  try {
    last = localStorage.getItem(key);
  } catch {
    // none kept
  }
  return (libraries.find((l) => l.id === last) ?? libraries[0])?.id;
}

// librariesHref is where the Libraries item leads.
export function librariesHref(libraries: { id: string }[]): string | undefined {
  const id = lastLibraryId(libraries);
  return id && `/library/${id}`;
}

// The sort each profile last chose, in this browser: a library opened
// without one in its address is sorted that way.
const sortKey = 'overfin-web-sort';

function sorts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(sortKey) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function rememberSort(profile: string | undefined, sort: string): void {
  if (!profile) return;
  try {
    localStorage.setItem(sortKey, JSON.stringify({ ...sorts(), [profile]: sort }));
  } catch {
    // Not kept: libraries open sorted by name.
  }
}

export function lastSort(profile: string | undefined): string | undefined {
  return profile ? sorts()[profile] : undefined;
}
