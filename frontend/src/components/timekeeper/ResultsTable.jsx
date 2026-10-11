import { getRaceNumberBadgeStyle } from '../../utils/raceNumbers.js';
import { pointsForRank } from '../../utils/points.js';
import { activeEntries } from './startListHelpers.js';
import { TK_ACCENT_FILL, TK_ACCENT_GRADIENT, TK_ACCENT_TEXT } from './TimekeeperChrome.jsx';
import VisuallyHidden from '../ms/VisuallyHidden/VisuallyHidden.jsx';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * The one results table in the app.
 *
 * The timekeeper's ResultsView and the public LiveTiming page render the same
 * ranking of the same rows; they used to hold two copies that had already
 * drifted apart in the sort comparator. The canonical order is the one the
 * printed/official results use: time, then status, then start number, then id.
 *
 * Protějšek na serveru je rank_category v backend/app/services/results.py -
 * musí zůstat v souladu, protože online se pořadí i body počítají tam
 * a offline tady.
 */

/** Race times are always shown with two decimals; '—' when not measured. */
export const formatResultTime = (time) => (time != null ? time.toFixed(2) : '—');

const STATUS_ORDER = { DSQ: 1, DNF: 2, DNS: 3 };

/**
 * DNF/DNS/DSQ řádku startovní listiny.
 *
 * Výsledkové API posílá hotové `status`, startovní listina jen tři příznaky -
 * z rozpracované startovky se ale tiskne stejná sestava, takže se tady sjednotí.
 */
export const resultStatus = (entry) => {
  if (entry.status !== undefined) return entry.status;
  if (entry.dsq) return 'DSQ';
  if (entry.dnf) return 'DNF';
  if (entry.dns) return 'DNS';
  return null;
};

/**
 * Sort entries into finishing order and attach `display_rank`, `display_points`
 * and `display_diff` (shared rank AND shared points on a dead heat,
 * null rank for DNF/DNS/DSQ).
 *
 * The start_number → id tiebreak keeps a dead heat in a stable, deterministic
 * order so the spectator view and the official results cannot disagree.
 *
 * `timeField` přepíná, podle čeho se řadí: 'time_sum' je celkový výsledek,
 * 'time1'/'time2' je pořadí jednoho kola. Kola se tisknou zvlášť, protože
 * jedna kategorie může jet obě kola a jiná jen jedno.
 *
 * Vyřazení ze startky (isExcluded) do pořadí nepatří a vypadnou tady, ať
 * přijdou odkudkoli - pořadí i body ostatních se počítají, jako by
 * nestartovali. Tudy jde tabulka výsledků i každá tištěná výsledková listina.
 */
export const rankEntriesByTime = (entries, { timeField = 'time_sum' } = {}) => {
  const timeOf = (entry) => entry[timeField] ?? null;
  const hasTimeOf = (entry) => resultStatus(entry) == null && timeOf(entry) != null;

  const sortable = activeEntries(entries).sort((a, b) => {
    const aHasTime = hasTimeOf(a);
    const bHasTime = hasTimeOf(b);
    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;

    if (aHasTime && bHasTime) {
      if (timeOf(a) !== timeOf(b)) return timeOf(a) - timeOf(b);
    }

    const aStatus = STATUS_ORDER[resultStatus(a)] ?? 99;
    const bStatus = STATUS_ORDER[resultStatus(b)] ?? 99;
    if (aStatus !== bStatus) return aStatus - bStatus;

    const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });

  let lastTime = null;
  let lastRank = 0;
  let winnerTime = null;
  return sortable.map((entry, index) => {
    const hasTime = hasTimeOf(entry);
    const time = timeOf(entry);
    let rank = null;
    if (hasTime) {
      rank = time === lastTime ? lastRank : index + 1;
      lastTime = time;
      lastRank = rank;
      if (winnerTime == null) winnerTime = time;
    }
    return {
      ...entry,
      status: resultStatus(entry),
      display_rank: rank,
      display_points: pointsForRank(rank),
      display_diff: hasTime && rank !== 1 ? time - winnerTime : null
    };
  });
};

/** Gold/silver/bronze for the podium, plain number below it. */
export const PositionBadge = ({ position }) => {
  if (!position) return <span className="text-muted">—</span>;
  if (position === 1) return <span className="badge" style={{ background: '#FFD700', color: '#000', fontSize: '0.75rem' }}>1.</span>;
  if (position === 2) return <span className="badge" style={{ background: '#C0C0C0', color: '#000', fontSize: '0.75rem' }}>2.</span>;
  if (position === 3) return <span className="badge" style={{ background: '#CD7F32', color: '#000', fontSize: '0.75rem' }}>3.</span>;
  return <span className="fw-bold">{position}.</span>;
};

/**
 * Category selector shared by ResultsView and LiveTiming.
 * The visibility guards stay at the call sites - the two pages disagree on when
 * the row should appear at all.
 *
 * @param {Array} categories - [{ category_id, category_name, entries }]
 * @param {string|number} selectedId
 * @param {(id: string) => void} onSelect
 * @param {string} [inactiveClass] - 'btn-outline-dark' on the light timekeeper
 *   background, 'btn-outline-light' on the dark public page.
 */
export const CategoryPills = ({ categories, selectedId, onSelect, inactiveClass = 'btn-outline-dark' }) => (
  <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
    <div className="card-body py-2 px-3">
      <div className="d-flex align-items-center gap-1 flex-wrap">
        <small className="fw-semibold me-1" style={{ color: TK_ACCENT_TEXT }}>
          <Icon name="tag" className="me-1" />Kat:
        </small>
        {categories.map((cat) => {
          const isActive = String(selectedId) === String(cat.category_id);
          return (
            <button
              key={cat.category_id}
              className={`btn py-0 px-2 ${isActive ? '' : inactiveClass}`}
              style={{
                fontSize: '0.75rem',
                borderRadius: '12px',
                ...(isActive ? { background: TK_ACCENT_FILL, color: 'white', border: 'none' } : {}),
              }}
              onClick={() => onSelect(String(cat.category_id))}
            >
              {cat.category_name} ({cat.entries.length})
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

/**
 * @param {Array} entries - raw (unranked) entries of one category
 * @param {boolean} [showPoints] - the 'Body' column exists only on the
 *   timekeeper's results screen; live timing has no points yet.
 */
export default function ResultsTable({ entries, showPoints = false }) {
  const ranked = rankEntriesByTime(entries);

  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
        <thead className="table-light">
          <tr>
            <th style={{ width: '70px', padding: '4px 8px' }}>Pořadí</th>
            <th style={{ width: '72px', padding: '4px 8px' }}>Dres</th>
            <th style={{ padding: '4px 8px' }}>Závodník</th>
            <th style={{ padding: '4px 8px' }}>Klub</th>
            <th style={{ width: '75px', padding: '4px 8px' }} className="text-end">Jízda 1</th>
            <th style={{ width: '75px', padding: '4px 8px' }} className="text-end">Jízda 2</th>
            <th style={{ width: '85px', padding: '4px 8px' }} className="text-end fw-bold">Celk. čas</th>
            {showPoints && <th style={{ width: '55px', padding: '4px 8px' }} className="text-center">Body</th>}
            <th style={{ width: '50px', padding: '4px 8px' }}>Stav</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((entry) => (
            <tr key={entry.id} className={entry.status ? 'table-light text-muted' : ''}>
              <td className="text-center" style={{ padding: '3px 8px' }}><PositionBadge position={entry.display_rank} /></td>
              <td style={{ padding: '3px 8px' }}>
                <span className="badge" style={{ ...getRaceNumberBadgeStyle(entry.set_color), fontSize: '0.8rem' }}>
                  {entry.race_number_actual ?? '—'}
                </span>
              </td>
              <td style={{ padding: '3px 8px' }}>
                <span className="fw-semibold">{entry.racer_surname} {entry.racer_name}</span>
                <small className="text-muted ms-1">({entry.racer_year})</small>
              </td>
              <td className="text-muted" style={{ padding: '3px 8px' }}>{entry.club_name || '—'}</td>
              <td className="text-end" style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{entry.status ? '—' : formatResultTime(entry.time1)}</td>
              <td className="text-end" style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{entry.status ? '—' : formatResultTime(entry.time2)}</td>
              <td className="text-end fw-bold" style={{ padding: '3px 8px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {entry.status ? <span className="text-muted">{entry.status}</span> : formatResultTime(entry.time_sum)}
              </td>
              {showPoints && (
                <td className="text-center" style={{ padding: '3px 8px' }}>
                  {entry.points != null && entry.points > 0 ? (
                    <span className="badge" style={{ background: TK_ACCENT_GRADIENT, fontSize: '0.7rem' }}>{entry.points}</span>
                  ) : <span className="text-muted">0</span>}
                </td>
              )}
              <td className="text-center" style={{ padding: '3px 8px' }}>
                {entry.status === 'DNF' && <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>DNF</span>}
                {entry.status === 'DNS' && <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>DNS</span>}
                {entry.status === 'DSQ' && <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>DSQ</span>}
                {!entry.status && entry.time_sum != null && <><Icon name="success" className="text-success" style={{ fontSize: '0.8rem' }} /><VisuallyHidden>Dokončil</VisuallyHidden></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
