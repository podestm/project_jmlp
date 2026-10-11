import { memo } from 'react';
import { Badge, Button } from '../../ms/index.js';
import BibNumber from '../BibNumber/BibNumber.jsx';
import { isExcluded } from '../startListHelpers.js';
import { getSexLabel, getSexLetter } from './racers.js';
import styles from './RacerRow.module.css';

/**
 * Řádek tabulky závodníků (jen ke čtení). Memoizovaný, aby psaní do
 * formuláře „Přidat závodníka“ nepřekreslovalo celou tabulku.
 *
 * Vyřazený ze startky je pořád přihlášený závodník, proto tu je – jen
 * označený stejně jako v Listině, kde se dá vrátit.
 */
const RacerRow = memo(function RacerRow({ entry, onEdit }) {
  const excluded = isExcluded(entry);
  const name = `${entry.racer_surname} ${entry.racer_name}`;

  return (
    <tr data-state={excluded ? 'muted' : undefined}>
      <td data-numeric>{entry.start_number || '—'}</td>
      <td><BibNumber number={entry.race_number_actual} setColor={entry.set_color} /></td>
      <td data-numeric>{entry.race_number_display ?? '—'}</td>
      <td>
        <span className={styles.racer}>
          <span className={styles.nameRow}>
            <span className={excluded ? styles.excludedName : styles.name}>{name}</span>
            {excluded && <Badge tone="neutral" size="sm">vyřazen</Badge>}
          </span>
          <span className={styles.club}>{entry.club_name || 'Bez oddílu'}</span>
        </span>
      </td>
      <td data-numeric>{entry.racer_year}</td>
      <td>
        <span className={styles.sex}>
          <span className={styles.sexLetter} aria-hidden="true">{getSexLetter(entry.racer_sex)}</span>
          {getSexLabel(entry.racer_sex)}
        </span>
      </td>
      <td className={entry.category_name ? undefined : styles.noCategory}>{entry.category_name || 'Bez kategorie'}</td>
      <td data-align="end">
        <Button size="sm" onClick={() => onEdit(entry)} aria-label={`Upravit ${name}`}>Upravit</Button>
      </td>
    </tr>
  );
});

export default RacerRow;
