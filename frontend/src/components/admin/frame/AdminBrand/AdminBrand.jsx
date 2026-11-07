import { cx } from '../../../ms/cx.js';
import styles from './AdminBrand.module.css';

/**
 * Identita administrace: „JMLP ADMINISTRACE“ a pod tím ročník
 * (postranní panel, mobilní lišta a menu). `size` md = panel, sm = mobil.
 */
export default function AdminBrand({ subtitle, size = 'md', className }) {
  return (
    <span className={cx(styles.brand, styles[size], className)}>
      <span className={styles.text}>
        <span className={styles.name}>JMLP Administrace</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
    </span>
  );
}
