// Čisté funkce obrazovky Závody (texty řádků, souhrn nad seznamem).
import { czechPlural, raceOrder, seasonLabel } from '../../../utils/races.js';
import { formatSeasonShort } from '../../../utils/season.js';

/** race_method_id 2 = suchý slalom, cokoli jiného = závod na sněhu (výchozí). */
export const methodLabel = (race) => (race.race_method_id === 2 ? 'suchý slalom' : 'závod na sněhu');

/** „FreeSki Academy Brno · suchý slalom“ – druhý řádek u názvu závodu. */
export const raceSubtitle = (race) => [race.organizer_name, methodLabel(race)].filter(Boolean).join(' · ');

export const registrationsWord = (count) => czechPlural(count, ['přihláška', 'přihlášky', 'přihlášek']);

/** „2 závody · 1 s otevřenou registrací“ */
export const listSummary = (races) => {
  const open = races.filter((race) => race.registration).length;
  return `${races.length} ${czechPlural(races.length, ['závod', 'závody', 'závodů'])} · ${open} s otevřenou registrací`;
};

/** Volba filtru: „Sezóna 2026/27 — XX. ročník“ */
export const seasonOptionLabel = (seasonId) => `Sezóna ${seasonLabel(seasonId)}`;

/** Text vedle H1: vybraná sezóna, nebo „všechny sezóny“. */
export const seasonMeta = (seasonFilter) => (
  seasonFilter ? `sezóna ${formatSeasonShort(Number(seasonFilter))}` : 'všechny sezóny'
);

/** „JMLP2026-01“ → „1. závod sezóny“ (null bez čísla). */
export const orderLabel = (raceNr) => {
  const order = raceOrder({ race_nr: raceNr });
  return order ? `${order}. závod sezóny` : null;
};
