import { NavLink } from 'react-router';
import { cx } from '../../components/cx';
import s from './mobile.module.css';

const tab = ({ isActive }: { isActive: boolean }) => cx(s.tab, isActive && s.on);

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
