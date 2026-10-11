import { Table, TableScroll, VisuallyHidden } from '../../ms/index.js';
import { fixEncoding } from '../../../utils/text.js';
import { cellText, raceColumnLabel } from './standings.js';
import styles from './StandingsTable.module.css';

/**
 * Pořadí jedné kategorie (Vysledky): místo, závodník, klub, body v každém
 * závodě (započtené podbarvené – přípravný jantarově, na sněhu modře),
 * součty přípravných, sněhových a celkem.
 */
export default function StandingsTable({ category, races, className }) {
  return (
    <TableScroll label={`Pořadí – ${category.name}`} className={className}>
      <Table caption={`Pořadí poháru – ${category.name}`} className={styles.table}>
        <thead>
          <tr>
            <th scope="col" data-align="center">Poř.</th>
            <th scope="col">Závodník</th>
            <th scope="col">Klub</th>
            {races.map((race) => {
              const label = raceColumnLabel(race);
              return (
                <th key={race.id} scope="col" data-align="center" className={styles.raceHead}>
                  <span className={styles.raceDate}>{label.date}</span>
                  <span>{label.place}</span>
                  <span>{label.kind}</span>
                </th>
              );
            })}
            <th scope="col" data-align="end">Přípr.</th>
            <th scope="col" data-align="end">Sníh</th>
            <th scope="col" data-align="end">Celkem</th>
          </tr>
        </thead>
        <tbody>
          {category.rows.map((row) => (
            <tr key={`${row.surname}-${row.name}-${row.year}`}>
              <td data-align="center">
                {row.rank ? <span className={styles.rank} data-podium={row.rank === 1 || undefined}>{row.rank}</span> : '—'}
              </td>
              <td>
                <span className={styles.name}>{row.surname} {row.name}</span>
                {row.year && <span className={styles.year}> ({row.year})</span>}
              </td>
              <td className={styles.club}>{fixEncoding(row.club) || '—'}</td>
              {row.cells.map((cell, index) => (
                <td
                  key={races[index].id}
                  data-align="center"
                  data-numeric
                  className={styles.cell}
                  data-counted={cell?.counted ? races[index].kind : undefined}
                  data-status={cell?.status ? true : undefined}
                >
                  {cellText(cell)}
                  {cell?.counted && <VisuallyHidden> (započteno)</VisuallyHidden>}
                </td>
              ))}
              <td data-align="end" data-numeric className={styles.sum}>{row.prep_points}</td>
              <td data-align="end" data-numeric className={styles.sum}>{row.snow_points}</td>
              <td data-align="end" data-numeric className={styles.total}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
