import { cx } from '../../ms/cx.js';
import { formatResultTime, rankEntriesByTime } from '../../../utils/results.js';
import RaceFlag from '../StartList/RaceFlag.jsx';
import { formatLoss, sharedRanks } from './resultsView.js';
import styles from './ResultsList.module.css';

/**
 * Pořadí kategorie na telefonu (TkMobilVysledky): řádek na závodníka –
 * pořadí, jméno, klub a dres, vpravo čas a pod ním ztráta a body.
 * Stejná data i řazení jako ResultsTable.
 */
export default function ResultsList({ entries }) {
  const ranked = rankEntriesByTime(entries);
  const shared = sharedRanks(ranked);

  return (
    <ol className={styles.list} aria-label="Pořadí v kategorii">
      {ranked.map((entry) => (
        <li key={entry.id} className={styles.row}>
          <span className={cx(styles.rank, entry.display_rank === 1 && styles.first)}>{entry.display_rank ?? '—'}</span>
          <span className={styles.text}>
            <span className={styles.name}>
              {entry.racer_surname} {entry.racer_name}
              {entry.racer_year && <span className={styles.muted}> ({entry.racer_year})</span>}
            </span>
            <span className={styles.muted}>
              {entry.club_name || '—'}
              {entry.race_number_actual != null && ` · dres ${entry.race_number_actual}`}
            </span>
            {shared.has(entry.display_rank) && <span className={styles.note}>Dělené {entry.display_rank}. místo</span>}
          </span>
          <span className={styles.value}>
            {entry.status
              ? <RaceFlag flag={entry.status.toLowerCase()} />
              : <span className={styles.time}>{formatResultTime(entry.time_sum)}</span>}
            <span className={styles.muted}>
              {entry.status ? '' : `${formatLoss(entry)} · `}{entry.points > 0 ? entry.points : 0} b.
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
