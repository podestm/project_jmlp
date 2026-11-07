import { cx } from '../../../ms/cx.js';
import styles from './TkPage.module.css';

/**
 * Kořen obrazovky časomíry: odsazení obsahu pod
 * lištou (24 px). Obsah skládá kit a modul obrazovky.
 */
export default function TkPage({ className, children }) {
  return <div className={cx(styles.page, className)}>{children}</div>;
}
