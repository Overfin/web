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

// librariesHref is where the Libraries item leads.
export function librariesHref(libraries: { id: string }[]): string | undefined {
  let last: string | null = null;
  try {
    last = localStorage.getItem(key);
  } catch {
    // none kept
  }
  const library = libraries.find((l) => l.id === last) ?? libraries[0];
  return library && `/library/${library.id}`;
}
