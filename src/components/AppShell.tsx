import { NavLink, Outlet, useNavigate } from 'react-router';
import { isMac, isMod, PAGE_KEY_LABELS, pageShortcut } from '../keys/keys';
import { SHORTCUTS_KEY } from '../keys/shortcuts';
import { useWindowKeyDown } from '../keys/useWindowKeyDown';
import { useStore } from '../store/store';
import { Icon } from './icons';
import { openShortcuts, ShortcutsDialog } from './ShortcutsDialog';
import { Toaster } from './Toaster';
import { useRefreshOnReturn } from './useRefreshOnReturn';

/**
 * Header with the page title and navigation; ⌥T / ⌥O / ⌥S switch pages and ⌘/ lists the shortcuts, from anywhere.
 * Returning to the window refreshes.
 */
export function AppShell() {
  const navigate = useNavigate();
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  useRefreshOnReturn();

  useWindowKeyDown(
    (e) => {
      if (isMod(e) && !e.altKey && !e.shiftKey && e.key === '/') {
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
    <div className="app">
      {status === 'loading' && <p className="loading">Loading…</p>}
      {status === 'error' && <p className="loading">Could not reach the server: {error}</p>}
      {status === 'ready' && <Outlet />}
      <Toaster />
      <ShortcutsDialog />
    </div>
  );
}

export function PageHeader({ title }: { title: string }) {
  return (
    <header className="app-header">
      <div className="app-title">
        <Icon name="table" size={20} weight={1.8} />
        <h1>{title}</h1>
      </div>
      <nav className="app-nav" aria-label="Main">
        <NavLink
          to="/transactions"
          className={({ isActive }) => (isActive ? 'nav active' : 'nav')}
          aria-keyshortcuts="Alt+T"
        >
          Transactions
          <span className="nkbd" aria-hidden="true">
            {PAGE_KEY_LABELS.transactions}
          </span>
        </NavLink>
        <NavLink
          to="/overview"
          className={({ isActive }) => (isActive ? 'nav active' : 'nav')}
          aria-keyshortcuts="Alt+O"
        >
          Overview
          <span className="nkbd" aria-hidden="true">
            {PAGE_KEY_LABELS.overview}
          </span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => (isActive ? 'nav active' : 'nav')}
          aria-keyshortcuts="Alt+S"
        >
          Settings
          <span className="nkbd" aria-hidden="true">
            {PAGE_KEY_LABELS.settings}
          </span>
        </NavLink>
        <button
          type="button"
          className="nav"
          // the focus stays on the page, so closing the dialog returns to it
          onMouseDown={(e) => e.preventDefault()}
          onClick={openShortcuts}
          aria-keyshortcuts={isMac ? 'Meta+/' : 'Control+/'}
        >
          Shortcuts
          <span className="nkbd" aria-hidden="true">
            {SHORTCUTS_KEY}
          </span>
        </button>
      </nav>
    </header>
  );
}
