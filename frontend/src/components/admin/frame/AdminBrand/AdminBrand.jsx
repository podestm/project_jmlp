import znak from '../../../../assets/images/jmlp_znak_88.png';
import { cx } from '../../../ms/cx.js';
import styles from './AdminBrand.module.css';

/**
 * Identita administrace: znak, „JMLP ADMINISTRACE“ a pod tím ročník
 * (postranní panel, mobilní lišta a menu). `size` md = panel, sm = mobil.
 */
export default function AdminBrand({ subtitle, size = 'md', className }) {
  return (
    <span className={cx(styles.brand, styles[size], className)}>
      <img src={znak} alt="" width="38" height="38" className={styles.logo} />
      <span className={styles.text}>
        <span className={styles.name}>JMLP Administrace</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
    </span>
  );
}
