import { cx } from '../cx.js';
import Spinner from '../Spinner/Spinner.jsx';
import styles from './LoadingState.module.css';

/**
 * Načítání: spinner a jeden viditelný text v role="status" (StavyVerejnehoWebu
 * „Načítám aktuality…“). Text čte i čtečka, spinner je dekorativní.
 * - variant page (blok v obsahu) | inline (malý, v kartě) | fullscreen (na střed okna)
 */
export default function LoadingState({ variant = 'page', label = 'Načítám…', className }) {
  return (
    <div role="status" className={cx(styles.loading, styles[variant], className)}>
      <Spinner size={variant === 'inline' ? 18 : 22} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
