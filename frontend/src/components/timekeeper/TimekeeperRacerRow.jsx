import React from 'react';
import RaceNumberBadge from './RaceNumberBadge.jsx';

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
 */
const TimekeeperRacerRow = React.memo(function TimekeeperRacerRow({ entry, onEdit }) {
  return (
    <tr>
      <td className="fw-bold">{entry.start_number || '—'}</td>
      <td>
        <RaceNumberBadge
          actualNumber={entry.race_number_actual}
          displayNumber={entry.race_number_display}
          setColor={entry.set_color}
          smallTopMargin={false}
        />
      </td>
      <td>
        <span className="fw-semibold">{entry.racer_surname} {entry.racer_name}</span>
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
