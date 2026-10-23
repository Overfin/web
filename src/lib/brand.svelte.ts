// Whose brand the site shows: Overfin's, or the operator's own once they
// switch it on (their name, logo and banners). It's read once, before
// anyone signs in, and gives the tab its title and icon. Until it's known,
// the header's brand, the title and the icon stay empty: neither brand
// shows before its time.
import type { Branding } from './sdk/overfin.js';
import { overfin } from './client';

export const brand = $state<Branding & { ready: boolean }>({ ready: false, custom: false, name: 'Overfin', banner: {} });

export async function loadBrand(): Promise<void> {
  try {
    Object.assign(brand, await overfin.branding());
  } catch {
    // Overfin's, then.
  }
  document.title = brand.name;
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) icon.href = brand.custom && brand.logo ? brand.logo : '/logo.svg';
  brand.ready = true;
}
