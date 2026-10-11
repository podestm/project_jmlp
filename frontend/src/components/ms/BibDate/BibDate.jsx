import { cx } from '../cx.js';
import VisuallyHidden from '../VisuallyHidden/VisuallyHidden.jsx';
import { czechDateParts } from './czechDate.js';
import styles from './BibDate.module.css';

/**
 * Datum jako startovní číslo (BRIEF, signaturní prvek 2). Jedna komponenta ve
 * třech velikostech (DesignSystem):
 * - card: rámeček 96 × 108, celý den, velké číslo, celý měsíc (detail závodu)
 * - table: den zkratkou, číslo, „říj 26“ (tabulky administrace)
 * - row: číslo a zkratka dne pod ním (DataRow)
 * Čtečka dostane celé datum („sobota 3. října 2026“), zkratky jsou skryté.
 */
export default function BibDate({ date, variant = 'table', className }) {
  const parts = czechDateParts(date);
  return (
    <time dateTime={parts.iso} className={cx(styles.bib, styles[variant], className)}>
      <span className={styles.visual} aria-hidden="true">
        {variant === 'card' && (
          <>
            <span className={styles.caps}>{parts.weekday}</span>
            <span className={styles.number}>{parts.day}</span>
            <span className={cx(styles.caps, styles.navy)}>{parts.month}</span>
          </>
        )}
        {variant === 'table' && (
          <>
            <span className={styles.caps}>{parts.weekdayShort}</span>
            <span className={styles.number}>{parts.day}</span>
            <span className={cx(styles.caps, styles.navy)}>{parts.monthShort} {parts.yearShort}</span>
          </>
        )}
        {variant === 'row' && (
          <>
            <span className={styles.number}>{parts.day}</span>
            <span className={cx(styles.caps, styles.navy)}>{parts.weekdayShort}</span>
          </>
        )}
      </span>
      <VisuallyHidden>{parts.spoken}</VisuallyHidden>
    </time>
  );
}
