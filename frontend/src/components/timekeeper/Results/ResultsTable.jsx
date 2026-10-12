import { Rank, Table, TableScroll } from '../../ms/index.js';
import { formatResultTime, rankEntriesByTime } from '../../../utils/results.js';
import BibNumber from '../BibNumber/BibNumber.jsx';
import RaceFlag from '../StartList/RaceFlag.jsx';
import { formatLoss, sharedRanks } from './resultsView.js';
import styles from './ResultsTable.module.css';

/** Pořadí v kitovém Rank (pódium: 1 teplý akcent, 2–3 navy), bez pořadí pomlčka. */
const Position = ({ rank }) => (rank ? <Rank place={rank} size="lg" /> : '—');

/**
 * Tabulka výsledků jedné kategorie v časomíře (TkVysledky). Veřejný živý
 * přenos má vlastní (pages/Live/LiveResultsTable). Řazení, časy a vyřazení ze
 * startky řeší rankEntriesByTime – tady se jen kreslí.
 *
 * @param {Array} entries neseřazené řádky jedné kategorie
 * @param {boolean} [showPoints] sloupec Body (jen obrazovka Výsledky)
 */
export default function ResultsTable({ entries, showPoints = false }) {
  const ranked = rankEntriesByTime(entries);
  const shared = sharedRanks(ranked);

  return (
    <TableScroll label="Pořadí v kategorii">
      <Table density="compact" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Pořadí</th>
            <th scope="col">Dres</th>
            <th scope="col">Závodník</th>
            <th scope="col">Klub</th>
            <th scope="col" data-align="end">Kolo 1</th>
            <th scope="col" data-align="end">Kolo 2</th>
            <th scope="col" data-align="end">Celkový čas</th>
            <th scope="col" data-align="end">Ztráta</th>
            {showPoints && <th scope="col" data-align="end">Body</th>}
            <th scope="col">Stav</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((entry) => (
            <tr key={entry.id} data-state={entry.status ? 'muted' : undefined}>
              <td><Position rank={entry.display_rank} /></td>
              <td><BibNumber number={entry.race_number_actual} setColor={entry.set_color} size="sm" /></td>
              <td>
                <span className={entry.status ? styles.nameMuted : styles.name}>{entry.racer_surname} {entry.racer_name}</span>
                {entry.racer_year && <span className={styles.year}> ({entry.racer_year})</span>}
              </td>
              <td className={styles.club}>{entry.club_name || '—'}</td>
              <td data-numeric data-align="end">{entry.status ? '—' : formatResultTime(entry.time1)}</td>
              <td data-numeric data-align="end">{entry.status ? '—' : formatResultTime(entry.time2)}</td>
              <td data-numeric data-align="end" className={styles.total}>
                {entry.status ? <span className={styles.statusText}>{entry.status}</span> : formatResultTime(entry.time_sum)}
              </td>
              <td data-numeric data-align="end" className={styles.loss}>{formatLoss(entry)}</td>
              {showPoints && (
                <td data-numeric data-align="end" className={styles.points}>{entry.points > 0 ? entry.points : 0}</td>
              )}
              <td>
                {entry.status ? <RaceFlag flag={entry.status.toLowerCase()} />
                  : shared.has(entry.display_rank) ? <span className={styles.note}>Dělené {entry.display_rank}. místo</span>
                    : entry.time_sum != null ? <span className={styles.note}>Dokončil</span>
                      : <span className={styles.note}>Čeká na čas</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
