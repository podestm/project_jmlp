// Čisté funkce kalendáře závodů: sezóny, filtr podle typu, rozdělení na
// nadcházející a odjeté a souhrnná věta nad seznamem.
import { formatSeasonShort, seasonEdition, toRoman } from '../../../utils/season.js';
import { czechPlural, raceDate, raceMethod, raceSeasonId } from '../../../utils/races.js';

/** Sezóny, které mají závod s číslem, od nejnovější. */
export const seasonsOf = (races) => (
  [...new Set(races.map(raceSeasonId).filter((id) => id !== null))].sort((a, b) => b - a)
);

/** „2026/27 — XX. ročník“ */
export const seasonLabel = (seasonId) => `${formatSeasonShort(seasonId)} — ${toRoman(seasonEdition(seasonId))}. ročník`;

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

const racesCount = (count) => `${count} ${czechPlural(count, ['závod', 'závody', 'závodů'])}`;

/** Věta vpravo od filtru: kde sezóna je. */
export const seasonSummary = ({ upcoming, past }) => {
  const total = upcoming.length + past.length;
  if (past.length === 0) return `Sezóna právě začíná · ${total} ${czechPlural(total, ['vypsaný závod', 'vypsané závody', 'vypsaných závodů'])}`;
  if (upcoming.length === 0) return `Sezóna skončila · ${racesCount(total)}`;
  return `Odjeto ${past.length} z ${total} ${czechPlural(total, ['závodu', 'závodů', 'závodů'])}`;
};
