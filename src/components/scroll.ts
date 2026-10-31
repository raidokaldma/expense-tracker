/** Scrolls `container` just enough to show `el`, keeping `margin` px clear at both edges. */
export function keepInView(container: HTMLElement | null, el: Element | null | undefined, margin = 0) {
  if (!container || !el) return;
  const box = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < box.top + margin) container.scrollTop -= box.top + margin - r.top;
  else if (r.bottom > box.bottom - margin) container.scrollTop += r.bottom - (box.bottom - margin);
}

/** Scrolls the page just enough to show `el` below the sticky navbar. */
export function keepInWindow(el: Element | null | undefined, margin = 8) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const top = (document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0) + margin;
  if (r.top < top) window.scrollBy(0, r.top - top);
  else if (r.bottom > window.innerHeight - margin) window.scrollBy(0, r.bottom - window.innerHeight + margin);
}
