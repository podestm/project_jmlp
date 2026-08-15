import { formatDateLong } from '../../utils/date.js';

/**
 * Chrome shared by every timekeeper screen: the localStorage key that keeps the
 * selected race in sync between tabs, the selected-race bar and the message
 * banner. Each of these used to be re-declared per screen, and the banner had
 * already drifted into four variants.
 */

/** The one place the selected race is stored. Typos here used to be silent. */
export const SELECTED_RACE_KEY = 'timekeeper_selected_race';

/** "#12 — Vysočina (5. srpna 2026)" or the hint to pick a race first. */
export const formatRaceLabel = (race) => (
  race
    ? `${race.race_nr || `#${race.id}`} — ${race.areal_name || '?'} (${formatDateLong(race.datum)})`
    : 'Závod vyberte v Přehledu závodů'
);

/** Read-only selected-race bar used by Listina / Závodníci / Výsledky. */
export const SelectedRaceBar = ({ race }) => (
  <div className="d-flex align-items-center gap-2">
    <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
    <div className="form-control form-control-sm d-flex align-items-center" style={{ borderRadius: '8px', minHeight: '38px', background: '#fff' }}>
      {formatRaceLabel(race)}
    </div>
  </div>
);

const MESSAGE_ICONS = {
  success: 'bi-check-circle-fill',
  info: 'bi-info-circle-fill',
};

/**
 * Dismissible status banner.
 *
 * @param {{type: string, text: React.ReactNode}|null} message
 * @param {() => void} onDismiss
 */
export const TimekeeperMessage = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
      <i className={`bi ${MESSAGE_ICONS[message.type] || 'bi-exclamation-triangle-fill'} me-2`}></i>
      {message.text}
      <button type="button" className="btn-close ms-auto" style={{ fontSize: '0.7rem' }} onClick={onDismiss}></button>
    </div>
  );
};

export default TimekeeperMessage;
