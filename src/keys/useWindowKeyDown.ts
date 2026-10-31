import { useEffect, useRef } from 'react';

/**
 * Calls `onKey` for every key pressed anywhere on the page while the component is shown. With `capture` it runs
 * before the focused element sees the key. Always the latest `onKey`, so it can read current state.
 */
export function useWindowKeyDown(onKey: (e: KeyboardEvent) => void, { capture = false } = {}) {
  const latest = useRef(onKey);
  latest.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => latest.current(e);
    window.addEventListener('keydown', listener, capture);
    return () => window.removeEventListener('keydown', listener, capture);
  }, [capture]);
}
