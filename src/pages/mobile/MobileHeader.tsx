import { NavLink } from 'react-router';
import { cx } from '../../components/cx';
import s from './MobileHeader.module.css';

function tab({ isActive }: { isActive: boolean }) {
  return cx(s.tab, isActive && s.current);
}

export function MobileHeader() {
  return (
    <header className={s.header}>
      <nav className={s.tabs} aria-label="Main">
        <NavLink to="/transactions" className={tab}>
          Transactions
        </NavLink>
        <NavLink to="/overview" className={tab}>
          Overview
        </NavLink>
      </nav>
    </header>
  );
}
