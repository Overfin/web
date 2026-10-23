// The page's scrollbar shows only while the page scrolls (wheel, keys,
// touch, dragging it) and while the pointer is near it; the rest of the
// time it's hidden (app.css: html.scrolling).

const near = 28; // pixels from the window's right edge
const after = 1200; // ms it stays once scrolling stops

export function quietScrollbar() {
  const root = document.documentElement;
  let timer = 0;
  const show = () => {
    root.classList.add('scrolling');
    clearTimeout(timer);
    timer = window.setTimeout(() => root.classList.remove('scrolling'), after);
  };
  window.addEventListener('scroll', show, { passive: true });
  window.addEventListener('mousemove', (event) => {
    if (window.innerWidth - event.clientX < near) show();
  }, { passive: true });
}
