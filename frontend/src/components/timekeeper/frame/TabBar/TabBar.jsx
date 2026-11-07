import { Fragment, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { isNavActive, timekeeperNav } from '../../../ms/navItems.js';
import SectionSwitch from '../../../backoffice/SectionSwitch/SectionSwitch.jsx';
import UserBlock from '../UserBlock/UserBlock.jsx';
import { useActiveTabInView } from './useActiveTabInView.js';
import styles from './TabBar.module.css';

/**
 * Dolní lišta rámce (TkPrehled): šest kroků závodního dne, oddělovač,
 * obecné nastavení; vpravo přepínač sekcí (jen admin) a uživatel.
 * U admina pod 1440 px přepínač a uživatel bez popisků. Pod 1280 px (tablet)
 * mají taby ikonu nad krátkým popiskem – název musí být vidět i bez najetí myší.
 * Pod 768 px se taby, které se nevejdou, posouvají uvnitř lišty.
 */
export default function TabBar({ user, onLogout }) {
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin';
  const navRef = useRef(null);
  useActiveTabInView(navRef, pathname);

  return (
    <div className={styles.bar}>
      <nav ref={navRef} aria-label="Časomíra" className={styles.nav}>
        {timekeeperNav.map((item, index) => (
          <Fragment key={item.to}>
            {item.group === 'settings' && timekeeperNav[index - 1]?.group !== 'settings' && (
              <span className={styles.divider} aria-hidden="true" />
            )}
            <Link
              to={item.to}
              className={styles.tab}
              aria-current={isNavActive(item, pathname) ? 'page' : undefined}
            >
              <Icon name={item.icon} size={20} className={styles.icon} />
              <span className={cx(styles.label, item.short && styles.hasShort)}>{item.label}</span>
              {item.short && <span className={styles.short} aria-hidden="true">{item.short}</span>}
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
