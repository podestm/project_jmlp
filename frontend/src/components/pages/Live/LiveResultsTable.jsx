import { Badge, Rank, Table, TableScroll } from '../../ms/index.js';
import { bibVar } from '../../ms/tokens.js';
import { formatResultTime } from '../../../utils/results.js';
import { fixEncoding } from '../../../utils/text.js';
import styles from './LiveResultsTable.module.css';

/** Ztráta na vedoucího „+0.61“, u vedoucího a bez času pomlčka. */
export const formatDiff = (diff) => (diff != null ? `+${diff.toFixed(2)}` : '—');

/** Styl dresu v barvě sady startovních čísel. */
export const bibStyle = (entry) => ({ '--bib-color': `var(${bibVar(entry.set_color || 'rose')})` });

/**
 * Výsledková tabulka živého přenosu (Zive): pořadí, dres v barvě sady, jméno,
 * klub, časy jízd, celkový čas a ztráta. Řazení je stejné jako v časomíře
 * a na tištěné listině (utils/results.js). Body se tu neukazují – počítají
 * se až z oficiálních výsledků. ranked = rankEntriesByTime(entries).
 */
export default function LiveResultsTable({ category, ranked, className }) {
  return (
    <TableScroll label={`Výsledky – ${category.category_name}`} className={className}>
      <Table caption={`Průběžné výsledky kategorie ${category.category_name}`}>
        <thead>
          <tr>
            <th scope="col" data-align="center">
              Pořadí
            </th>
            <th scope="col" data-align="center">
              Dres
            </th>
            <th scope="col">Závodník</th>
            <th scope="col">Klub</th>
            <th scope="col" data-align="end">
              Jízda 1
            </th>
            <th scope="col" data-align="end">
              Jízda 2
            </th>
            <th scope="col" data-align="end">
              Celkový čas
            </th>
            <th scope="col" data-align="end">
              Ztráta
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((entry) => (
            <tr key={entry.id} data-state={entry.status ? 'muted' : undefined}>
              <td data-align="center">
                {entry.display_rank ? <Rank place={entry.display_rank} /> : '—'}
              </td>
              <td data-align="center">
                <span className={styles.bib} style={bibStyle(entry)}>
                  {entry.race_number_actual ?? '—'}
                </span>
              </td>
              <td>
                <span className={styles.name}>
                  {entry.racer_surname} {entry.racer_name}
                </span>
                {entry.racer_year && <span className={styles.year}> ({entry.racer_year})</span>}
              </td>
              <td className={styles.club}>{fixEncoding(entry.club_name) || '—'}</td>
              <td data-align="end" data-numeric>
                {entry.status ? '—' : formatResultTime(entry.time1)}
              </td>
              <td data-align="end" data-numeric>
                {entry.status ? '—' : formatResultTime(entry.time2)}
              </td>
              <td data-align="end" data-numeric className={styles.total}>
                {entry.status ? (
                  <Badge tone="dry" size="sm">
                    {entry.status}
                  </Badge>
                ) : (
                  formatResultTime(entry.time_sum)
                )}
              </td>
              <td data-align="end" data-numeric>
                {formatDiff(entry.display_diff)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
