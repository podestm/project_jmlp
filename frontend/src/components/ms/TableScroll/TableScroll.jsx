import { cx } from '../cx.js';
import styles from './TableScroll.module.css';

/**
 * Obal tabulky: bílá karta a vodorovné posouvání v každé šířce. Je to
 * pojmenovaná oblast s tabIndex=0, aby šla posouvat i z klávesnice.
 */
export default function TableScroll({ label, className, children }) {
  return (
    // tabIndex=0: posouvatelná oblast musí jít fokusovat (WCAG 2.1.1)
    <div role="region" aria-label={label} tabIndex={0} className={cx(styles.scroll, className)}>
      {children}
    </div>
  );
}
