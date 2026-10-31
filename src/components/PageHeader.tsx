import { NavLink } from 'react-router';
import { modAria, PAGE_KEY_LABELS } from '../keys/keys';
import { SHORTCUTS_KEY } from '../keys/shortcuts';
import { cx } from './cx';
import { Icon } from './icons';
import s from './PageHeader.module.css';
import { openShortcuts } from './ShortcutsDialog';

const PAGES = [
  { path: '/transactions', title: 'Transactions', keyLabel: PAGE_KEY_LABELS.transactions, aria: 'Alt+T' },
  { path: '/overview', title: 'Overview', keyLabel: PAGE_KEY_LABELS.overview, aria: 'Alt+O' },
  { path: '/settings', title: 'Settings', keyLabel: PAGE_KEY_LABELS.settings, aria: 'Alt+S' },
];

/** The sticky bar on top of every desktop page: the page title, links to the pages and the shortcuts. */
export function PageHeader({ title }: { title: string }) {
  return (
    <header className={s.header}>
      <div className={s.title}>
        <Icon name="table" size={20} weight={1.8} />
        <h1>{title}</h1>
      </div>
      <nav className={s.nav} aria-label="Main">
        {PAGES.map((page) => (
          <NavLink
            key={page.path}
            to={page.path}
            className={({ isActive }) => cx(s.link, isActive && s.active)}
            aria-keyshortcuts={page.aria}
          >
            {page.title}
            <span className={s.key} aria-hidden="true">
              {page.keyLabel}
            </span>
          </NavLink>
        ))}
        <button
          type="button"
          className={s.link}
          // the focus stays on the page, so closing the dialog returns to it
          onMouseDown={(e) => e.preventDefault()}
          onClick={openShortcuts}
          aria-keyshortcuts={modAria('/')}
        >
          Shortcuts
          <span className={s.key} aria-hidden="true">
            {SHORTCUTS_KEY}
          </span>
        </button>
      </nav>
    </header>
  );
}
