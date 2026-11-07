// Čisté funkce správy klubů (AdminKluby) – bez Reactu, s testem.
import { czechPlural } from '../../../utils/races.js';

export const PLATNOST = { vse: 'vse', platne: 'platne', neplatne: 'neplatne' };

/** Kluby podle hledaného názvu, platnosti a „jen pořadatelé“. */
export const filterClubs = (clubs, { query, onlyOrganizers, platnost }) => {
  const needle = query.trim().toLowerCase();
  return clubs.filter((club) => {
    if (onlyOrganizers && !club.organized_races_count) return false;
    if (platnost === PLATNOST.platne && !club.valid) return false;
    if (platnost === PLATNOST.neplatne && club.valid) return false;
    return !needle || club.name.toLowerCase().includes(needle);
  });
};

/** Počty pro záhlaví a filtr: pořadatelé, s logem, neplatné. */
export const clubCounts = (clubs) => ({
  total: clubs.length,
  organizers: clubs.filter((c) => c.organized_races_count > 0).length,
  withLogo: clubs.filter((c) => c.has_logo).length,
  invalid: clubs.filter((c) => !c.valid).length,
});

/** Hláška po smazání: kdo přešel kam. */
export const deletedMessage = (result) => {
  const moved =
    result.moved_racers || result.moved_races
      ? ` Závodníci (${result.moved_racers}) i pořádané závody (${result.moved_races})` +
        ` přešli na klub ${result.reassigned_to_name}.`
      : '';
  return `Klub ${result.name} byl smazán.${moved}`;
};

export const racersWord = (count) => czechPlural(count, ['závodník', 'závodníci', 'závodníků']);
export const racesWord = (count) =>
  czechPlural(count, ['pořádaný závod', 'pořádané závody', 'pořádaných závodů']);
export const clubsWord = (count) => czechPlural(count, ['klub', 'kluby', 'klubů']);
