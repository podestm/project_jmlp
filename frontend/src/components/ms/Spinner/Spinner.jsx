import { cx } from '../cx.js';
import styles from './Spinner.module.css';

/**
 * Točící se kroužek (artboardy: šedý kruh + navy oblouk). Je dekorativní –
 * text načítání nese LoadingState nebo tlačítko (Button busy).
 * tone="current" převezme barvu textu (uvnitř tlačítka).
 */
export default function Spinner({ size = 22, tone = 'navy', className }) {
  return (
    <svg
      className={cx(styles.spinner, styles[tone], className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.track} cx="12" cy="12" r="9" />
      <path className={styles.arc} d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}
