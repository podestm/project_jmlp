import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import { isNavActive, timekeeperNav } from '../../../ms/navItems.js';
import SectionSwitch from '../../../backoffice/SectionSwitch/SectionSwitch.jsx';
import UserBlock from '../UserBlock/UserBlock.jsx';
import styles from './TabBar.module.css';

/**
 * Dolní lišta rámce (TkPrehled): šest kroků závodního dne, oddělovač,
 * obecné nastavení; vpravo přepínač sekcí (jen admin) a uživatel.
 * U admina pod 1440 px přepínač a uživatel bez popisků, pod 1280 px i taby jen ikony, pod 1024 px ji nahradí mobilní menu.
 */
export default function TabBar({ user, onLogout }) {
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <div className={styles.bar}>
      <nav aria-label="Časomíra" className={styles.nav}>
        {timekeeperNav.map((item, index) => (
          <Fragment key={item.to}>
            {item.group === 'settings' && timekeeperNav[index - 1]?.group !== 'settings' && (
              <span className={styles.divider} aria-hidden="true" />
            )}
            <Link
              to={item.to}
              className={styles.tab}
              aria-current={isNavActive(item, pathname) ? 'page' : undefined}
              title={item.label}
            >
              <Icon name={item.icon} size={20} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
            </Link>
          </Fragment>
        ))}
      </nav>

      <div className={styles.end}>
        {isAdmin && (
          <>
            <SectionSwitch current="timekeeper" compact />
            <span className={styles.divider} aria-hidden="true" />
          </>
        )}
        <UserBlock user={user} onLogout={onLogout} compact={isAdmin} />
      </div>
    </div>
  );
}
