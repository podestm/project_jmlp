import { memo, useCallback } from 'react';
import { cx } from '../../ms/cx.js';
import BibNumber from '../BibNumber/BibNumber.jsx';
import OfflineBadge from '../OfflineBadge/OfflineBadge.jsx';
import RaceFlag, { FLAGS } from '../StartList/RaceFlag.jsx';
import styles from './TimingRow.module.css';

const FLAG_KEYS = Object.freeze(['dnf', 'dns', 'dsq']);

/**
 * Jeden řádek tabulky zadávání časů (TkZadavaniCasu).
 *
 * Nejžhavější místo aplikace: se startovkou o 250 závodnících se tabulka
 * dřív stavěla celá znovu při každé klávese. Řádek je memoizovaný podle
 * identity `times`, takže psaní do pole jednoho závodníka překreslí jen jeho
 * řádek. Platí to jen dokud handlery drží identitu – proto je TimingEntry
 * drží v useCallback, a proto tu nejsou žádné nové objekty stylů.
 */
const TimingRow = memo(function TimingRow({
  entry,
  times,
  activeRound,
  hasWriteLock,
  showCategory,
  registerInput,
  onTimeChange,
  onKeyDown,
  onBlur,
  onToggleFlag,
}) {
  const entryId = entry.id;
  const flag = times.dnf ? 'dnf' : times.dns ? 'dns' : times.dsq ? 'dsq' : null;
  const racerName = `${entry.racer_surname} ${entry.racer_name}`;

  // Navázané na řádek. Nová šipka by při každém vykreslení odpojila
  // a znovu připojila ref každého pole – to byla polovina původní ceny.
  const refTime1 = useCallback(
    (el) => registerInput(entryId, 'time1', el),
    [registerInput, entryId],
  );
  const refTime2 = useCallback(
    (el) => registerInput(entryId, 'time2', el),
    [registerInput, entryId],
  );

  const timeInput = (field, ref, lockedRound) => (
    <input
      ref={ref}
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      aria-label={`${field === 'time1' ? 'Kolo 1' : 'Kolo 2'} – ${racerName}`}
      className={cx(styles.time, activeRound === lockedRound && styles.locked)}
      value={times[field] || ''}
      onChange={(e) => onTimeChange(entryId, field, e.target.value)}
      onKeyDown={(e) => onKeyDown(e, entryId, field)}
      onBlur={() => onBlur(entryId, field)}
      placeholder="0.00"
      disabled={Boolean(flag) || activeRound === lockedRound || !hasWriteLock}
    />
  );

  return (
    <tr data-state={flag ? 'muted' : undefined}>
      <td data-numeric className={styles.start}>
        {entry.start_number || '—'}
      </td>
      <td>
        <BibNumber
          number={entry.race_number_actual ?? entry.race_number_display}
          setColor={entry.set_color}
          code={entry.race_number_display}
          size="sm"
        />
      </td>
      {/* Při užší tabulce ustupuje jméno (zkrátí se trojtečkou), ne pole časů. */}
      <td className={styles.racerCell}>
        <span className={styles.name} title={racerName}>
          <OfflineBadge entry={entry} className={styles.offline} />
          {racerName}
        </span>
        <span className={styles.club}>
          {entry.club_name || 'Bez klubu'}
          {showCategory ? ` · ${entry.category_name || '?'}` : ''} ({entry.racer_year})
        </span>
      </td>
      <td>{timeInput('time1', refTime1, '2')}</td>
      <td>{timeInput('time2', refTime2, '1')}</td>
      <td>
        <span className={styles.flags} role="group" aria-label={`Příznak – ${racerName}`}>
          {FLAG_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.flag}
              aria-pressed={Boolean(times[key])}
              onClick={() => onToggleFlag(entryId, key)}
              disabled={!hasWriteLock}
              title={FLAGS[key].title}
            >
              {FLAGS[key].label}
            </button>
          ))}
        </span>
      </td>
      <td data-numeric data-align="end" className={styles.sum}>
        {flag ? <RaceFlag flag={flag} /> : entry.time_sum != null ? entry.time_sum.toFixed(2) : '—'}
      </td>
    </tr>
  );
});

export default TimingRow;
