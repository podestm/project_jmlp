import { memo } from 'react';
import { Badge, Button, IconButton } from '../../ms/index.js';
import BibNumber from '../BibNumber/BibNumber.jsx';
import { isExcluded } from '../startListHelpers.js';
import RaceFlag, { flagOf } from './RaceFlag.jsx';
import styles from './StartListRow.module.css';

const time = (value) => (value != null ? value.toFixed(2) : '—');

/**
 * Řádek startovní listiny (jen ke čtení). Memoizovaný, aby psaní do opravy
 * jednoho řádku nepřekreslovalo všechny ostatní.
 *
 * Vyřazený ze startky zůstává v Listině vidět – jen tady se dá vrátit.
 * Přeškrtnuté jméno, štítek „vyřazen“ a stav řádku (data-state="muted") ho
 * odliší od závodníků, kteří na startovce opravdu jsou.
 */
const StartListRow = memo(function StartListRow({ entry, onEdit, onDelete, onToggleExcluded }) {
  const flag = flagOf(entry);
  const excluded = isExcluded(entry);
  const racerName = `${entry.racer_surname} ${entry.racer_name}`;

  return (
    <tr data-state={excluded ? 'muted' : undefined} className={excluded ? styles.excludedRow : undefined}>
      <td data-numeric>{entry.start_number || '—'}</td>
      <td><BibNumber number={entry.race_number_actual} setColor={entry.set_color} /></td>
      <td data-numeric className={styles.system}>{entry.race_number_display ?? '—'}</td>
      {/* Kategorie se neopakuje – řádek je v části své kategorie */}
      <td>
        <span className={styles.racer}>
          <span className={styles.nameRow}>
            <span className={excluded ? styles.excludedName : styles.name}>{racerName}</span>
            {excluded && (
              <Badge tone="navy" size="sm">vyřazen</Badge>
            )}
          </span>
          <span className={styles.club}>{entry.club_name || '—'}</span>
        </span>
      </td>
      <td data-numeric className={styles.year}>{entry.racer_year}</td>
      <td data-numeric data-align="end">{flag ? '—' : time(entry.time1)}</td>
      <td data-numeric data-align="end">{flag ? '—' : time(entry.time2)}</td>
      <td data-numeric data-align="end" className={styles.sum}>
        {flag ? <RaceFlag flag={flag} /> : time(entry.time_sum)}
      </td>
      <td>
        <span className={styles.actions}>
          {/* Vyřazení je vratné, proto bez potvrzovacího dialogu – za závodu
              se klikne rychle a omyl se opraví tlačítkem Vrátit. */}
          <Button
            size="sm"
            variant={excluded ? 'open' : 'outline'}
            icon={excluded ? 'undo' : 'user-minus'}
            onClick={() => onToggleExcluded(entry)}
            title={excluded
              ? 'Vrátit na startovní listinu i se vším, co u něj bylo zapsané'
              : 'Vyřadit ze startovní listiny (nedorazil) – nesmaže se, půjde vrátit'}
          >
            {excluded ? 'Vrátit' : 'Vyřadit'}
          </Button>
          <Button size="sm" onClick={() => onEdit(entry)} aria-label={`Upravit ${racerName}`}>Upravit</Button>
          <IconButton icon="trash" label="Odebrat" onClick={() => onDelete(entry.id, racerName)} />
        </span>
      </td>
    </tr>
  );
});

export default StartListRow;
