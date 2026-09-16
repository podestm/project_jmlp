import React, { useCallback } from 'react';
import RaceNumberBadge from './RaceNumberBadge.jsx';

/**
 * One row of the timing table.
 *
 * This is the hot path of the whole app: with a 250-racer start list the table
 * used to be rebuilt from scratch on every keystroke in a time field. The row is
 * memoised on `times` identity, so typing into one racer's field re-renders that
 * row only - every other row bails out. That only holds while the handler props
 * keep stable identities, which is why TimingEntry pins them with useCallback.
 */

/**
 * Pole zamčeného kola - vypnuté, ale čitelné.
 *
 * Dřív tu bylo opacity 0.6, při kterém měl už naměřený čas kontrast 3.87:1;
 * na slunci na břehu se nedal přečíst. Zašedlé to zůstává, jen ne na úkor
 * čitelnosti - stejný důvod jako u neaktivních sad dresů v admin.css.
 */
const LOCKED_INPUT_STYLE = Object.freeze({ background: '#e9ecef', opacity: 0.8 });

const NAME_CELL_STYLE = Object.freeze({ padding: '3px 6px', maxWidth: 0, width: '100%' });

const TimingRow = React.memo(function TimingRow({
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
  const hasFlag = times.dnf || times.dns || times.dsq;

  // Bound per row. A fresh arrow here would make React detach and re-attach
  // every input ref on every render, which was half the original cost.
  const refTime1 = useCallback((el) => registerInput(entryId, 'time1', el), [registerInput, entryId]);
  const refTime2 = useCallback((el) => registerInput(entryId, 'time2', el), [registerInput, entryId]);

  return (
    <tr className={hasFlag ? 'table-light' : ''}>
      <td className="fw-bold text-center" style={{ padding: '3px 6px' }}>{entry.start_number || '—'}</td>
      <td style={{ padding: '3px 6px' }}>
        <RaceNumberBadge
          actualNumber={entry.race_number_actual}
          displayNumber={entry.race_number_display}
          setColor={entry.set_color}
        />
      </td>
      {/* Při užší tabulce ustupuje jméno (zkrátí se trojtečkou), ne pole časů -
          maxWidth 0 dovolí buňce jít pod šířku textu, jinak by text-truncate
          nezabral a tabulka by přetekla do strany. */}
      <td style={NAME_CELL_STYLE}>
        <div className="fw-semibold text-truncate" title={`${entry.racer_surname} ${entry.racer_name}`}>
          {entry.racer_surname} {entry.racer_name}
        </div>
        <small className="text-muted d-block text-truncate">
          {entry.club_name || 'Bez klubu'}{showCategory ? ` | ${entry.category_name || '?'}` : ''} ({entry.racer_year})
        </small>
      </td>
      <td style={{ padding: '3px 4px' }}>
        <input
          ref={refTime1}
          type="number" step="0.01" min="0"
          className="form-control form-control-sm timing-time-input"
          style={{
            borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.82rem', padding: '2px 4px',
            ...(activeRound === '2' ? LOCKED_INPUT_STYLE : {})
          }}
          value={times.time1 || ''}
          onChange={(e) => onTimeChange(entryId, 'time1', e.target.value)}
          onKeyDown={(e) => onKeyDown(e, entryId, 'time1')}
          onBlur={() => onBlur(entryId, 'time1')}
          placeholder="0.00"
          disabled={hasFlag || activeRound === '2' || !hasWriteLock}
        />
      </td>
      <td style={{ padding: '3px 4px' }}>
        <input
          ref={refTime2}
          type="number" step="0.01" min="0"
          className="form-control form-control-sm timing-time-input"
          style={{
            borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.82rem', padding: '2px 4px',
            ...(activeRound === '1' ? LOCKED_INPUT_STYLE : {})
          }}
          value={times.time2 || ''}
          onChange={(e) => onTimeChange(entryId, 'time2', e.target.value)}
          onKeyDown={(e) => onKeyDown(e, entryId, 'time2')}
          onBlur={() => onBlur(entryId, 'time2')}
          placeholder="0.00"
          disabled={hasFlag || activeRound === '1' || !hasWriteLock}
        />
      </td>
      <td className="fw-bold text-center" style={{ padding: '3px 6px', fontFamily: 'monospace', fontSize: '0.86rem' }}>
        {hasFlag
          ? (times.dnf ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.68rem' }}>DNF</span>
            : times.dns ? <span className="badge bg-secondary" style={{ fontSize: '0.68rem' }}>DNS</span>
            : <span className="badge bg-danger" style={{ fontSize: '0.68rem' }}>DSQ</span>)
          : (entry.time_sum != null ? entry.time_sum.toFixed(2) : '—')}
      </td>
      <td style={{ padding: '3px 4px' }}>
        <div className="btn-group btn-group-sm">
          <button className={`btn py-0 px-1 ${times.dnf ? 'btn-warning' : 'btn-outline-warning'}`}
            style={{ fontSize: '0.68rem', borderRadius: '6px 0 0 6px' }}
            onClick={() => onToggleFlag(entryId, 'dnf')}
            disabled={!hasWriteLock}
            title="Did Not Finish">DNF</button>
          <button className={`btn py-0 px-1 ${times.dns ? 'btn-secondary' : 'btn-outline-secondary'}`}
            style={{ fontSize: '0.68rem' }}
            onClick={() => onToggleFlag(entryId, 'dns')}
            disabled={!hasWriteLock}
            title="Did Not Start">DNS</button>
          <button className={`btn py-0 px-1 ${times.dsq ? 'btn-danger' : 'btn-outline-danger'}`}
            style={{ fontSize: '0.68rem', borderRadius: '0 6px 6px 0' }}
            onClick={() => onToggleFlag(entryId, 'dsq')}
            disabled={!hasWriteLock}
            title="Disqualified">DSQ</button>
        </div>
      </td>
    </tr>
  );
});

export default TimingRow;
