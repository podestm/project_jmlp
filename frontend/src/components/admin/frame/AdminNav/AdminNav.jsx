import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, Icon, VisuallyHidden } from '../../../ms/index.js';
import { cx } from '../../../ms/cx.js';
import { adminNav, isNavActive } from '../../../ms/navItems.js';
import styles from './AdminNav.module.css';

/**
 * Položky administrace (navItems.adminNav) v pořadí artboardů, za
 * oddělovačem nastavení. Odznak s počtem u položek s `count`
 * (žádosti o kluby) – jen když je co vyřizovat.
 * - variant sidebar: postranní panel (44 px) | menu: mobilní menu (56 px, šipka)
 * - counts: { clubRequests: 3 }
 * - onNavigate: po výběru položky (mobilní menu se zavře)
 */
export default function AdminNav({ variant = 'sidebar', counts = {}, onNavigate, className }) {
  const { pathname } = useLocation();
  const inMenu = variant === 'menu';

  return (
    <nav aria-label="Administrace" className={cx(styles.nav, styles[variant], className)}>
      {adminNav.map((item, index) => {
        const count = item.count ? counts[item.count] || 0 : 0;
        const startsSettings = item.group === 'settings' && adminNav[index - 1]?.group !== 'settings';
        return (
          <Fragment key={item.to}>
            {startsSettings && <span className={styles.divider} aria-hidden="true" />}
            <Link
              to={item.to}
              className={styles.item}
              aria-current={isNavActive(item, pathname) ? 'page' : undefined}
              onClick={onNavigate}
            >
              <Icon name={item.icon} size={18} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
              {count > 0 && (
                <Badge tone="count" className={styles.count}>
                  {count}
                  <VisuallyHidden> čeká</VisuallyHidden>
                </Badge>
              )}
              {inMenu && <Icon name="chevron-right" size={20} strokeWidth={2.2} className={styles.chevron} />}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
