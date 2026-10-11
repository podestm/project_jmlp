import { Link } from 'react-router-dom';
import { cx } from '../../../ms/cx.js';
import Icon from '../../../ms/Icon/Icon.jsx';
import styles from './AdminPage.module.css';

/**
 * Kořen převedené obrazovky administrace (AdminDashboard): bílá lišta
 * 68 px s H1, `meta` hned za ním a akcemi vpravo, pod ní obsah
 * (24 px / 32 px). Pod 768 px (AdminMobilPrehled) je `meta` nadtitulek,
 * pod H1 `description` a akce pod záhlavím.
 * - back: { to, label } – odkaz zpět před H1 oddělený čarou (podstránka,
 *   AdminParovaniSlcr „‹ Závodníci“)
 */
export default function AdminPage({ title, meta, description, actions, back, className, children }) {
  return (
    <div className={cx('ms-scope', styles.page, className)}>
      <header className={styles.head}>
        {back && (
          <Link to={back.to} className={styles.back}>
            <Icon name="chevron-left" size={18} />
            {back.label}
          </Link>
        )}
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <p className={styles.meta}>{meta}</p>}
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
