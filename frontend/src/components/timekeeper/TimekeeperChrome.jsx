import { formatDateLong } from '../../utils/date.js';
import Icon from '../ms/Icon/Icon.jsx';

/**
 * Chrome shared by every timekeeper screen: the localStorage key that keeps the
 * selected race in sync between tabs and the selected-race bar. Each of these
 * used to be re-declared per screen. The message banner has its own file
 * (TimekeeperMessage.jsx).
 */

/**
 * Akcentová barva časoměřiče. Konkrétní odstíny dosazuje téma back-office
 * (admin.css, proměnné --tk-*) tak, aby měl text dost kontrastu - #e94560
 * sám má s bílou jen 3.8:1. Výchozí hodnota platí tam, kde téma není:
 * tabulka výsledků se ukazuje i na veřejném Live timingu.
 */
export const TK_ACCENT = 'var(--tk-accent, #e94560)'; // ikony, okraje
export const TK_ACCENT_TEXT = 'var(--tk-accent-text, #e94560)'; // text
export const TK_ACCENT_FILL = 'var(--tk-accent-fill, #e94560)'; // pozadí pod bílým textem
export const TK_ACCENT_GRADIENT = 'var(--tk-accent-gradient, linear-gradient(135deg, #e94560, #c23152))';

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
    <Icon name="trophy" style={{ color: TK_ACCENT }} />
    <div className="form-control form-control-sm d-flex align-items-center" style={{ borderRadius: '8px', minHeight: '38px', background: '#fff' }}>
      {formatRaceLabel(race)}
    </div>
  </div>
);
