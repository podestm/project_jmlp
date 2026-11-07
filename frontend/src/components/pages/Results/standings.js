// Popisky pořadí poháru (odpověď GET /season-results/{id}/standings).
import { czechPlural } from '../../../utils/races.js';

export const KIND_LABEL = { P: 'přípr.', S: 'sníh', F: 'finále' };

/** Záhlaví sloupce závodu: „4. 10.“ a zkratka areálu (první slovo). */
export const raceColumnLabel = (race) => {
  const [, month, day] = race.datum.split('-').map(Number);
  const place = (race.areal_name || '').split(/[\s–-]+/).filter(Boolean)[0] ?? '';
  return { date: `${day}. ${month}.`, place, kind: KIND_LABEL[race.kind] ?? '' };
};

/** Obsah buňky: body, nebo DSQ/DNF; bez startu pomlčka. */
export const cellText = (cell) => {
  if (!cell) return '—';
  return cell.status ?? String(cell.points);
};

/** Mobilní řádek: „7 závodů, započteny 4“. */
export const rowSummary = (row) => {
  const started = row.cells.filter(Boolean).length;
  const counted = row.cells.filter((cell) => cell?.counted).length;
  return `${started} ${czechPlural(started, ['závod', 'závody', 'závodů'])}, ${czechPlural(counted, ['započten', 'započteny', 'započteno'])} ${counted}`;
};

/** Nadtitulek: „Sezóna 2025/26 · XIX. ročník · Celkové výsledky po 7 závodech“. */
export const standingsEyebrow = (standings) => {
  const count = standings.races.length;
  const kind = standings.final ? 'Celkové výsledky' : 'Průběžné pořadí';
  return [
    `Sezóna ${standings.season_label}`,
    standings.edition_label && `${standings.edition_label} ročník`,
    count > 0 && `${kind} po ${count} ${czechPlural(count, ['závodě', 'závodech', 'závodech'])}`,
  ]
    .filter(Boolean)
    .join(' · ');
};
