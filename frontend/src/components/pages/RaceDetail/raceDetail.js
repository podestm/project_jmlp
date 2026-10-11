// Popisky detailu závodu z dat GET /races/{id}.
import { raceMethod, raceOrder } from '../../../utils/races.js';
import { fixEncoding } from '../../../utils/text.js';

/** „JMLP2026-01 · 1. závod sezóny“ */
export const raceEyebrow = (race) => {
  const order = raceOrder(race);
  return [race.race_nr, order && `${order}. závod sezóny`].filter(Boolean).join(' · ');
};

/** Název závodu = areál; bez areálu obecný nadpis. */
export const raceTitle = (race) => {
  const name = fixEncoding(race.areal_name);
  return name && name !== 'Bez areálu' ? name : 'Detail závodu';
};

/** Pořadatel, pokud je vyplněný. */
export const raceOrganizer = (race) => {
  const name = fixEncoding(race.organizer_name);
  return name && name !== 'Neznámý organizátor' ? name : null;
};

export { raceMethod };
