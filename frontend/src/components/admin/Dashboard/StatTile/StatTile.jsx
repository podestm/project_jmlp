import { cx } from '../../../ms/cx.js';
import styles from './StatTile.module.css';

/**
 * Dlaždice s číslem (AdminDashboard „Metriky“): nadpis verzálkami, číslo
 * v Plex Mono a vysvětlivka. Bez hodnoty (chyba načtení) jen pomlčky
 * (AdminPrehledChyba). tone: navy | open (horní linka).
 */
export default function StatTile({ label, value, hint, tone = 'navy', className }) {
  const empty = value === null || value === undefined;
  return (
    <div className={cx(styles.tile, styles[tone], className)}>
      <span className={styles.label}>{label}</span>
      <span className={cx(styles.value, empty && styles.empty)}>
        {empty ? <span aria-label="nenačteno">———</span> : value}
      </span>
      {hint && !empty && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
