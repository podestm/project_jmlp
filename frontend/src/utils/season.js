// Season Utilities
// season_id is the START year: 2025 = season 2025/2026 (1.8.2025 - 31.7.2026).
import { SEASON_CONFIG } from '../config/constants.js';

/**
 * Sezóna, do které patří datum (hranice 1. 8.). Na otázku „která sezóna je
 * teď“ odpovídá useCurrentSeason – aktuální sezónu volí správce; tohle je jen
 * převod data a záloha, dokud server neodpoví.
 * @param {Date} [referenceDate]
 * @returns {number}
 */
export const seasonIdForDate = (referenceDate = new Date()) =>
  SEASON_CONFIG.seasonIdForDate(referenceDate);

/**
 * Season id a race on the given date belongs to.
 * @param {string|Date} raceDate
 * @returns {number}
 */
export const getSeasonIdForRace = (raceDate) =>
  seasonIdForDate(typeof raceDate === 'string' ? new Date(raceDate) : raceDate);

/**
 * Display form of a season - "2025/2026".
 * @param {number} seasonId
 * @returns {string}
 */
export const formatSeason = (seasonId) => SEASON_CONFIG.formatSeason(seasonId);

/** Pohár jede od roku 2006: sezóna 2006/07 = I. ročník, 2026/27 = XX. */
export const EDITION_BASE_YEAR = 2006;

/** Římské číslo (1 → 'I', 20 → 'XX'); pro nulu a záporná čísla prázdný řetězec. */
export const toRoman = (value) => {
  const numerals = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = Number(value);
  if (!remaining || remaining <= 0) return '';
  return numerals.reduce((acc, [num, sym]) => {
    while (remaining >= num) {
      acc += sym;
      remaining -= num;
    }
    return acc;
  }, '');
};

/** Ročník poháru podle sezóny – stejné číslo předvyplňuje správa sezón. */
export const seasonEdition = (seasonId) => seasonId - EDITION_BASE_YEAR;

/** Krátký tvar sezóny do hlavičky a patičky – "2026/27". */
export const formatSeasonShort = (seasonId) => `${seasonId}/${String(seasonId + 1).slice(-2)}`;

/**
 * Next free race number within a season - "JMLP2025-03".
 * @param {Array} existingRaces
 * @param {number} seasonId
 * @returns {string}
 */
export const generateRaceNumber = (existingRaces, seasonId) => {
  const prefix = `JMLP${seasonId}-`;

  const maxNumber = existingRaces.reduce((max, race) => {
    if (race.season_id !== seasonId || !race.race_nr?.startsWith(prefix)) return max;
    const number = parseInt(race.race_nr.slice(prefix.length), 10);
    return Number.isNaN(number) ? max : Math.max(max, number);
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(2, '0')}`;
};

export default {
  seasonIdForDate,
  seasonEdition,
  formatSeasonShort,
  getSeasonIdForRace,
  formatSeason,
  generateRaceNumber,
};
