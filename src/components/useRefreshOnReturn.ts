import { useEffect } from 'react';
import { refresh } from '../store/store';

/** Coming back to the window or tab reads the data again, so an import done meanwhile shows without a reload. */
export function useRefreshOnReturn() {
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
}
