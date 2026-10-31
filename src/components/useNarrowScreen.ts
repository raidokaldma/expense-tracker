import { useSyncExternalStore } from 'react';

const query = window.matchMedia('(max-width: 700px)');
function subscribe(onChange: () => void) {
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Phone-sized window: pages switch to their read-only mobile views. */
export function useNarrowScreen() {
  return useSyncExternalStore(subscribe, () => query.matches);
}
