import { fixEncoding } from '../../../utils/text.js';
import { rowSummary } from './standings.js';
import styles from './StandingsList.module.css';

/** Pořadí kategorie na telefonu (MobilVysledky): místo, jméno, klub, celkem bodů. */
export default function StandingsList({ category, className }) {
  return (
    <ol className={`${styles.list} ${className ?? ''}`} aria-label={`Pořadí – ${category.name}`}>
      {category.rows.map((row) => (
        <li key={`${row.surname}-${row.name}-${row.year}`} className={styles.row}>
          <span className={styles.rank} data-podium={row.rank === 1 || undefined}>{row.rank ?? '—'}</span>
          <span className={styles.text}>
            <span className={styles.name}>{row.surname} {row.name}</span>
            <span className={styles.meta}>{[fixEncoding(row.club), rowSummary(row)].filter(Boolean).join(' · ')}</span>
          </span>
          <span className={styles.points}>
            <span className={styles.total}>{row.total}</span>
            <span className={styles.unit}>bodů</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
