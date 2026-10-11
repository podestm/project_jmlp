import { cx } from '../../../ms/cx.js';
import styles from './TkPage.module.css';

/**
 * Kořen převedené obrazovky časomíry: .ms-scope a odsazení obsahu pod
 * lištou (24 px). Obsah skládá kit a modul obrazovky.
 */
export default function TkPage({ className, children }) {
  return <div className={cx('ms-scope', styles.page, className)}>{children}</div>;
}
