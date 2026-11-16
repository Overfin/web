// An image shows once it's there: until then its frame shimmers. On the
// image, `use:loaded` marks it, and its frame, ready when it has loaded (or
// failed, so the frame stops shimmering either way). One the browser had
// already (there within a tenth of a second) shows at once, without its
// fade: going from page to page, pictures already seen don't blink.
export function loaded(img: HTMLImageElement) {
  const start = performance.now();
  const done = () => {
    // Without the fade only for this once: its other transitions (a zoom
    // on hover) come back once it's shown.
    if (performance.now() - start < 100) {
      img.style.transition = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => (img.style.transition = '')));
    }
    img.classList.add('loaded');
    img.parentElement?.classList.add('ready');
  };
  if (img.complete) done();
  img.addEventListener('load', done);
  img.addEventListener('error', done);
  return {
    destroy() {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
    },
  };
}
