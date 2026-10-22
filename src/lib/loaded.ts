// An image shows once it's there: until then its frame shimmers. On the
// image, `use:loaded` marks it, and its frame, ready when it has loaded (or
// failed, so the frame stops shimmering either way).
export function loaded(img: HTMLImageElement) {
  const done = () => {
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
