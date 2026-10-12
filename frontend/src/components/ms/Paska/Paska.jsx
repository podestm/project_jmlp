import { cx } from '../cx.js';
import styles from './Paska.module.css';

/**
 * Páska – signaturní nadpis sekce (BRIEF): Archivo verzálkami 16 px a pod ním
 * 2px linka, jejíž prvních 40 px je teplý akcent (ms-sun). `aside` se vykreslí vpravo od
 * nadpisu (počet, odkaz „Všechny…“).
 */
export default function Paska({ as: Heading = 'h2', id, aside, className, children }) {
  return (
    <div className={cx(styles.paska, className)}>
      <div className={styles.row}>
        <Heading id={id} className={styles.title}>{children}</Heading>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      <div className={styles.line} aria-hidden="true" />
    </div>
  );
}
