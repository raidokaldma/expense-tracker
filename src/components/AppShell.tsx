import { Outlet, useNavigate } from 'react-router';
import { isModKey, pageShortcut } from '../keys/keys';
import { useWindowKeyDown } from '../keys/useWindowKeyDown';
import { useStore } from '../store/store';
import s from './AppShell.module.css';
import { openShortcuts, ShortcutsDialog } from './ShortcutsDialog';
import { Toaster } from './Toaster';
import { useRefreshOnReturn } from './useRefreshOnReturn';

/**
 * Header with the page title and navigation; ⌥T / ⌥O / ⌥S switch pages and ⌘/ lists the shortcuts, from anywhere.
 * Returning to the window refreshes.
 */
export function AppShell() {
  const navigate = useNavigate();
  const status = useStore((st) => st.status);
  const error = useStore((st) => st.error);
  useRefreshOnReturn();

  useWindowKeyDown(
    (e) => {
      if (isModKey(e, '/')) {
        e.preventDefault();
        openShortcuts();
        return;
      }
      const to = pageShortcut(e);
      if (!to) return;
      e.preventDefault();
      e.stopPropagation();
      // an open editor saves on blur, so leaving the page never loses a typed value
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      navigate(to);
    },
    { capture: true },
  );

  return (
    <div className={s.app}>
      {status === 'loading' && <p className={s.loading}>Loading…</p>}
      {status === 'error' && <p className={s.loading}>Could not reach the server: {error}</p>}
      {status === 'ready' && <Outlet />}
      <Toaster />
      <ShortcutsDialog />
    </div>
  );
}
