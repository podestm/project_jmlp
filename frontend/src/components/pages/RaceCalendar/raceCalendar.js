// Čisté funkce kalendáře závodů: sezóny, filtr podle typu, rozdělení na
// nadcházející a odjeté a souhrnná věta nad seznamem.
import { raceDate, raceMethod } from '../../../utils/races.js';

/** Filtr Vše / Na sněhu / Suché (race_method_id 1 = sníh, jinak suché). */
export const METHOD_FILTERS = [
  { value: 'all', label: 'Vše' },
  { value: 'snow', label: 'Na sněhu', shortLabel: 'Sníh', icon: 'snowflake' },
  { value: 'dry', label: 'Suché', icon: 'tree' },
];

export const matchesFilter = (race, filter) => filter === 'all' || raceMethod(race).key === filter;

/** Nadcházející od nejbližšího, odjeté od posledního. */
export const splitByDate = (races, today) => {
  const withDate = races.map((race) => ({ race, date: raceDate(race) }));
  const upcoming = withDate.filter(({ date }) => !date || date >= today).sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
  const past = withDate.filter(({ date }) => date && date < today).sort((a, b) => b.date - a.date);
  return { upcoming: upcoming.map(({ race }) => race), past: past.map(({ race }) => race) };
};


