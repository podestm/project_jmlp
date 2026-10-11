import { Badge } from '../../ms/index.js';
import { formatResultTime } from '../../../utils/results.js';
import { fixEncoding } from '../../../utils/text.js';
import { STATUS_LABEL, formatDiff } from './LiveResultsTable.jsx';
import styles from './LiveResultsList.module.css';

/**
 * Výsledky kategorie na telefonu (MobilZive): řádek s pořadím, jménem,
 * klubem a dresem, vpravo celkový čas a ztráta (u vedoucího obě jízdy).
 */
export default function LiveResultsList({ ranked, className }) {
  return (
    <ol className={`${styles.list} ${className ?? ''}`}>
      {ranked.map((entry) => (
        <li key={entry.id} className={styles.row} data-muted={entry.status ? true : undefined}>
          <span className={styles.rank} data-podium={entry.display_rank === 1 || undefined}>{entry.display_rank ?? '—'}</span>
          <span className={styles.text}>
            <span className={styles.name}>{entry.racer_surname} {entry.racer_name}</span>
            <span className={styles.meta}>{[fixEncoding(entry.club_name), entry.race_number_actual != null && `dres ${entry.race_number_actual}`].filter(Boolean).join(' · ')}</span>
          </span>
          {entry.status ? (
            <Badge tone="dry" size="sm">{STATUS_LABEL[entry.status] ?? entry.status} · {entry.status}</Badge>
          ) : (
            <span className={styles.times}>
              <span className={styles.total}>{formatResultTime(entry.time_sum)}</span>
              <span className={styles.sub}>
                {entry.display_rank === 1
                  ? `${formatResultTime(entry.time1)} + ${formatResultTime(entry.time2)}`
                  : formatDiff(entry.display_diff)}
              </span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
