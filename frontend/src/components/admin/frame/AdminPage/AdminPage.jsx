import { cx } from '../../../ms/cx.js';
import styles from './AdminPage.module.css';

/**
 * Kořen převedené obrazovky administrace (AdminDashboard): bílá lišta
 * 68 px s H1, `meta` hned za ním a akcemi vpravo, pod ní obsah
 * (24 px / 32 px). Pod 768 px (AdminMobilPrehled) je `meta` nadtitulek
 * a akce pod záhlavím.
 */
export default function AdminPage({ title, meta, actions, className, children }) {
  return (
    <div className={cx(styles.page, className)}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <p className={styles.meta}>{meta}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
