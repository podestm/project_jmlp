import { Rank, Table, TableScroll, VisuallyHidden } from '../../ms/index.js';
import { fixEncoding } from '../../../utils/text.js';
import { cellText, raceColumnLabel } from './standings.js';
import styles from './StandingsTable.module.css';

// Šířky sloupců z CSS (Poř. + Přípr. + Sníh + Celkem, jeden závod, závodník + klub):
// tabulka je aspoň tak široká, aby závodník a klub měli místo; jinak se posouvá.
const FIXED_WIDTH = 72 + 96 + 96 + 104;
const RACE_WIDTH = 96;
const NAME_CLUB_WIDTH = 440;

/**
 * Pořadí jedné kategorie (Vysledky): místo, závodník, klub, body v každém
 * závodě (započtené podbarvené – přípravný jantarově, na sněhu modře),
 * součty přípravných, sněhových a celkem.
 */
export default function StandingsTable({ category, races, className }) {
  return (
    <TableScroll label={`Pořadí – ${category.name}`} className={className}>
      <Table
        caption={`Pořadí poháru – ${category.name}`}
        fixed
        className={styles.table}
        style={{ '--table-min': `${FIXED_WIDTH + races.length * RACE_WIDTH + NAME_CLUB_WIDTH}px` }}
      >
        <thead>
          <tr>
            <th scope="col" data-align="center" className={styles.rankHead}>
              Poř.
            </th>
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
            <th scope="col" data-align="center" className={styles.sumHead}>
              Přípr.
            </th>
            <th scope="col" data-align="center" className={styles.sumHead}>
              Sníh
            </th>
            <th scope="col" data-align="center" className={styles.totalHead}>
              Celkem
            </th>
          </tr>
        </thead>
        <tbody>
          {category.rows.map((row) => (
            <tr key={`${row.surname}-${row.name}-${row.year}`}>
              <td data-align="center">{row.rank ? <Rank place={row.rank} /> : '—'}</td>
              <td>
                <span className={styles.name}>
                  {row.surname} {row.name}
                </span>
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
              <td data-align="center" data-numeric className={styles.sum}>
                {row.prep_points}
              </td>
              <td data-align="center" data-numeric className={styles.sum}>
                {row.snow_points}
              </td>
              <td data-align="center" data-numeric className={styles.total}>
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableScroll>
  );
}
