import { formatDateLong } from '../../utils/date.js';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Zbytky starého vzhledu časomíry pro nepřevedené obrazovky. Vybraný závod
 * je ve frame/selectedRace.js, rámec ve frame/.
 */

/**
 * Akcentová barva starých obrazovek časomíry – navy tokeny Modré stopy
 * (dřív červená --tk-accent). Zmizí s posledním převodem obrazovky.
 */
export const TK_ACCENT = 'var(--ms-navy)'; // ikony, okraje
export const TK_ACCENT_TEXT = 'var(--ms-navy)'; // text
export const TK_ACCENT_FILL = 'var(--ms-navy)'; // pozadí pod bílým textem
export const TK_ACCENT_GRADIENT = 'var(--ms-navy)';

/** "#12 — Vysočina (5. srpna 2026)" or the hint to pick a race first. */
export const formatRaceLabel = (race) => (
  race
    ? `${race.race_nr || `#${race.id}`} — ${race.areal_name || '?'} (${formatDateLong(race.datum)})`
    : 'Závod vyberte v Přehledu závodů'
);

/** Read-only selected-race bar used by Listina / Závodníci / Výsledky. */
export const SelectedRaceBar = ({ race }) => (
  <div className="d-flex align-items-center gap-2">
    <Icon name="trophy" style={{ color: TK_ACCENT }} />
    <div className="form-control form-control-sm d-flex align-items-center" style={{ borderRadius: '8px', minHeight: '38px', background: '#fff' }}>
      {formatRaceLabel(race)}
    </div>
  </div>
);
