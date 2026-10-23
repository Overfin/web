// weigh sizes a title's logo so every logo has about the same area, whatever
// its shape: a wide one comes out wider and lower, a compact one narrower
// and taller, within an outer limit. (The size is set from script: the
// site's CSP allows no inline style attribute.)
export function weigh(img: HTMLImageElement) {
  const size = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const phone = window.innerWidth < 600;
    const area = (phone ? 50 : 90) * rem * rem;
    let width = Math.sqrt(area * ratio);
    let height = width / ratio;
    const maxWidth = Math.min(26 * rem, window.innerWidth * 0.8);
    const maxHeight = (phone ? 6 : 9) * rem;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width *= scale;
    height *= scale;
    img.style.width = `${Math.round(width)}px`;
    img.style.height = `${Math.round(height)}px`;
  };
  if (img.complete) size();
  img.addEventListener('load', size);
  window.addEventListener('resize', size);
  return {
    destroy() {
      img.removeEventListener('load', size);
      window.removeEventListener('resize', size);
    },
  };
}
