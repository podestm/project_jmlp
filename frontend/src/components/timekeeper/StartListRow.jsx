import React from 'react';
import RaceNumberBadge from './RaceNumberBadge.jsx';
import { isExcluded } from './startListHelpers.js';

/**
 * Read-only start-list row.
 *
 * Memoised so that typing in the inline edit form of one racer no longer
 * rebuilds every other row in every category table.
 *
 * Vyřazený ze startky zůstává v Listině vidět - jen tady se dá vrátit.
 * Šedé pozadí s přeškrtnutým jménem a štítek ho odliší od závodníků, kteří na
 * startovce opravdu jsou (barvy v admin.css, tr.tk-row-excluded).
 */
const StartListRow = React.memo(function StartListRow({ entry, onEdit, onDelete, onToggleExcluded }) {
  const hasFlag = entry.dnf || entry.dns || entry.dsq;
  const excluded = isExcluded(entry);
  const racerName = `${entry.racer_surname} ${entry.racer_name}`;

  return (
    <tr className={excluded ? 'tk-row-excluded' : undefined}>
      <td className="fw-bold" style={{ padding: '4px 8px' }}>{entry.start_number || '—'}</td>
      <td style={{ padding: '4px 8px' }}>
        <RaceNumberBadge
          actualNumber={entry.race_number_actual}
          displayNumber={entry.race_number_display}
          setColor={entry.set_color}
        />
      </td>
      {/* Kategorie se neopakuje - řádek je v tabulce své kategorie */}
      <td className="fw-semibold" style={{ padding: '4px 8px' }}>
        <span className={excluded ? 'tk-excluded-name' : undefined}>{racerName}</span>
        {Number(entry.id) < 0 && (
          <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.65rem' }}
            title="Přidán offline - na server se odešle po obnovení připojení">offline</span>
        )}
        {excluded && (
          <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}
            title="Vyřazen ze startovní listiny - není na startovce, v časech ani ve výsledcích">
            vyřazen
          </span>
        )}
      </td>
      <td style={{ padding: '4px 8px' }}>{entry.racer_year}</td>
      <td className="text-muted" style={{ padding: '4px 8px' }}>{entry.club_name || '—'}</td>
      <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {hasFlag ? '—' : (entry.time1 != null ? entry.time1.toFixed(2) : '—')}
      </td>
      <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {hasFlag ? '—' : (entry.time2 != null ? entry.time2.toFixed(2) : '—')}
      </td>
      <td className="fw-bold" style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {entry.dnf ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>DNF</span>
          : entry.dns ? <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>DNS</span>
          : entry.dsq ? <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>DSQ</span>
          : (entry.time_sum != null ? entry.time_sum.toFixed(2) : '—')}
      </td>
      <td style={{ padding: '4px 8px' }}>
        <div className="d-flex gap-1">
          {/* Vyřazení je vratné, proto bez potvrzovacího dialogu - za závodu
              se klikne rychle a omyl se opraví tlačítkem Vrátit. */}
          <button
            className={`btn btn-sm py-0 px-1 ${excluded ? 'btn-success' : 'btn-outline-secondary'}`}
            style={{ fontSize: '0.7rem' }}
            onClick={() => onToggleExcluded(entry)}
            title={excluded
              ? 'Vrátit na startovní listinu i se vším, co u něj bylo zapsané'
              : 'Vyřadit ze startovní listiny (nedorazil) - nesmaže se, půjde vrátit'}
          >
            {excluded ? 'Vrátit' : 'Vyřadit'}
          </button>
          <button className="btn btn-sm btn-outline-primary py-0 px-1" style={{ fontSize: '0.7rem' }}
            onClick={() => onEdit(entry)} title="Upravit">
            <i className="bi bi-pencil"></i>
          </button>
          <button className="btn btn-sm btn-outline-danger py-0 px-1" style={{ fontSize: '0.7rem' }}
            onClick={() => onDelete(entry.id, racerName)} title="Odebrat">
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  );
});

export default StartListRow;
