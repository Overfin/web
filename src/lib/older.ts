// What older browsers lack and the site (Svelte's own code too) uses:
// TVs' browsers can be Chromium 79 (webOS 6), which has no
// String.replaceAll (85), Element.replaceChildren (86) or structuredClone
// (98). Each is added only where it's missing, doing what the site needs.

export function addMissing() {
  const strings = String.prototype as any;
  if (!strings.replaceAll) {
    strings.replaceAll = function (this: string, pattern: string | RegExp, replacement: any) {
      if (pattern instanceof RegExp && !pattern.global) throw new TypeError('replaceAll needs a global regular expression');
      // A string as a global regular expression that finds it as it is.
      const every = pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      return this.replace(every, replacement);
    };
  }
  if (typeof Element !== 'undefined' && !(Element.prototype as any).replaceChildren) {
    (Element.prototype as any).replaceChildren = function (this: Element, ...nodes: (Node | string)[]) {
      while (this.lastChild) this.removeChild(this.lastChild);
      this.append(...nodes);
    };
  }
  const global = globalThis as any;
  if (!global.structuredClone) {
    // Svelte copies dates with it; plain data otherwise.
    global.structuredClone = (value: unknown): unknown => {
      if (value instanceof Date) return new Date(value.getTime());
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    };
  }
}
