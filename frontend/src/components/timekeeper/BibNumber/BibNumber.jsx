import { cx } from '../../ms/cx.js';
import { setColorVar } from '../../../utils/raceNumbers.js';
import styles from './BibNumber.module.css';

/**
 * Číslo dresu (TkZavodnici, TkStartovniListina): Plex Mono v boxu na
 * sunken a 4px lišta vlevo v barvě sady – skutečné barvě dresu. Bez čísla
 * pomlčka. Barva sadu jen podtrhuje, číslo nese text.
 */
export default function BibNumber({ number, setColor, size = 'md', className }) {
  if (number == null || number === '') {
    return <span className={cx(styles.empty, className)}>—</span>;
  }
  return (
    <span className={cx(styles.bib, styles[size], className)} style={{ '--bib-color': setColorVar(setColor) }}>
      {number}
    </span>
  );
}
