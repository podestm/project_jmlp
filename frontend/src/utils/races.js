// Stav a popis závodu pro veřejný web (kalendář, detail, úvod, výsledky).
// Jen čisté funkce nad daty z GET /races/ – obrazovky z nich skládají řádky
// a odznaky.
import { formatSeasonShort, seasonEdition, toRoman } from './season.js';

/** Dnešek o půlnoci – závod „dnes“ ještě není odjetý. */
export const startOfToday = (now = new Date()) => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
};

/** Datum závodu (YYYY-MM-DD) jako místní půlnoc, ne UTC. */
export const raceDate = (race) => {
  if (!race?.datum) return null;
  const [year, month, day] = String(race.datum).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Stav přihlášek:
 * - open: registrace otevřená – má přednost před datem, admin ji může
 *   otevřít i u závodu, který už proběhl
 * - past: závod už proběhl (datum před dneškem) a registrace je zavřená
 * - closed: závod teprve bude, ale přes web se přihlásit nedá
 */
export const registrationState = (race, today = startOfToday()) => {
  if (race.registration) return 'open';
  const date = raceDate(race);
  if (date && date < today) return 'past';
  return 'closed';
};

/** Odznak stavu: text (nese význam), tón odznaku a lišty řádku. */
export const REGISTRATION_STATE = {
  open: { label: 'Registrace otevřena', badge: 'open', bar: 'open', icon: 'check' },
  closed: { label: 'Registrace uzavřena', badge: 'neutral', bar: 'closed' },
  past: { label: 'Ukončen', badge: 'neutral', bar: 'neutral' },
};

/** Typ závodu z race_method_id: 1 = na sněhu, cokoli jiného = suchý závod. */
export const raceMethod = (race) => (
  race.race_method_id === 1
    ? { key: 'snow', label: 'Na sněhu', icon: 'snowflake' }
    : { key: 'dry', label: 'Suchý závod', icon: 'tree' }
);

/** Sezóna podle čísla závodu „JMLP2026-03“ → 2026 (null bez čísla). */
export const raceSeasonId = (race) => {
  const match = /^JMLP(\d{4})/.exec(race?.race_nr ?? '');
  return match ? Number(match[1]) : null;
};

/** Pořadí v sezóně podle čísla závodu „JMLP2026-03“ → 3 (null bez čísla). */
export const raceOrder = (race) => {
  const match = /-(\d+)$/.exec(race?.race_nr ?? '');
  return match ? Number(match[1]) : null;
};

/** Česká množná čísla: czechPlural(2, ['závod', 'závody', 'závodů']) → 'závody'. */
export const czechPlural = (count, [one, few, many]) => {
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
};

/** Sezóny, které mají závod s číslem, od nejnovější. */
export const seasonsOf = (races) => (
  [...new Set(races.map(raceSeasonId).filter((id) => id !== null))].sort((a, b) => b - a)
);

/**
 * Výchozí sezóna výběru: aktuální, pokud má závody (nebo žádná sezóna závody
 * nemá); jinak nejnovější se závody, aby výběr nezůstal prázdný.
 */
export const defaultSeasonId = (seasons, currentSeasonId) => (
  seasons.length === 0 || seasons.includes(currentSeasonId) ? currentSeasonId : seasons[0]
);

/** „2026/27 — XX. ročník“ */
export const seasonLabel = (seasonId) => `${formatSeasonShort(seasonId)} — ${toRoman(seasonEdition(seasonId))}. ročník`;
