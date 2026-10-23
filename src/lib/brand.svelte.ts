// Whose brand the site shows: Overfin's, or the operator's own once they
// switch it on (their name, logo and banners). It's read once, before
// anyone signs in, and gives the tab its title and icon.
import type { Branding } from './sdk/overfin.js';
import { overfin } from './client';

export const brand = $state<Branding>({ custom: false, name: 'Overfin', banner: {} });

export async function loadBrand(): Promise<void> {
  let b: Branding;
  try {
    b = await overfin.branding();
  } catch {
    return; // Overfin's, as the page has it
  }
  Object.assign(brand, b);
  document.title = b.name;
  if (b.custom && b.logo) {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) {
      icon.removeAttribute('type');
      icon.href = b.logo;
    }
  }
}
