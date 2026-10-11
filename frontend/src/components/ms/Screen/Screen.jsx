import { cx } from '../cx.js';
import styles from './Screen.module.css';

/**
 * Kořen obrazovky nebo sekce (veřejné stránky, administrace, časomíra):
 * vyplní výšku mezi hlavičkou a patičkou rámce.
 */
export default function Screen({ className, children }) {
  return <div className={cx(styles.screen, className)}>{children}</div>;
}
