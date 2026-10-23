import React from 'react';
import RaceNumberBadge from './RaceNumberBadge.jsx';
import { isExcluded } from './startListHelpers.js';

export const getSexLabel = (sex) => {
  if (Number(sex) === 1) return 'Muž';
  if (Number(sex) === 2) return 'Žena';
  return 'Neznámé';
};

/**
 * Read-only row of the race-entrant table.
 *
 * Memoised so that typing in the "Přidat závodníka" form above no longer
 * rebuilds the whole table below it on every character.
 *
 * Vyřazený ze startky je pořád přihlášený závodník, proto tu je - jen
 * označený stejně jako v Listině, kde se dá vrátit.
 */
const TimekeeperRacerRow = React.memo(function TimekeeperRacerRow({ entry, onEdit }) {
  const excluded = isExcluded(entry);

  return (
    <tr className={excluded ? 'tk-row-excluded' : undefined}>
      <td className="fw-bold">{entry.start_number || '—'}</td>
      <td>
        <RaceNumberBadge
          actualNumber={entry.race_number_actual}
          displayNumber={entry.race_number_display}
          setColor={entry.set_color}
        />
      </td>
      <td>
        <span className={`fw-semibold${excluded ? ' tk-excluded-name' : ''}`}>{entry.racer_surname} {entry.racer_name}</span>
        {Number(entry.id) < 0 && (
          <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.65rem' }}
            title="Přidán offline - na server se odešle po obnovení připojení">
            offline
          </span>
        )}
        {excluded && (
          <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}
            title="Vyřazen ze startovní listiny - vrátit jde v Listině">
            vyřazen
          </span>
        )}
      </td>
      <td>{entry.racer_year}</td>
      <td>{getSexLabel(entry.racer_sex)}</td>
      <td>{entry.category_name || 'Bez kategorie'}</td>
      <td className="text-muted">{entry.club_name || 'Bez oddílu'}</td>
      <td>
        <button className="btn btn-sm btn-outline-primary py-0 px-1" style={{ fontSize: '0.7rem' }}
          onClick={() => onEdit(entry)} title="Upravit">
          <i className="bi bi-pencil"></i>
        </button>
      </td>
    </tr>
  );
});

export default TimekeeperRacerRow;
