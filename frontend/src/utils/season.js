// Season Utilities
// season_id is the START year: 2025 = season 2025/2026 (1.8.2025 - 31.7.2026).
import { SEASON_CONFIG } from '../config/constants.js';

/**
 * Season id for a given date (defaults to now).
 * @param {Date} [referenceDate]
 * @returns {number}
 */
export const getCurrentSeasonId = (referenceDate = new Date()) => (
  SEASON_CONFIG.getCurrentSeasonId(referenceDate)
);

/**
 * Season id a race on the given date belongs to.
 * @param {string|Date} raceDate
 * @returns {number}
 */
export const getSeasonIdForRace = (raceDate) => (
  getCurrentSeasonId(typeof raceDate === 'string' ? new Date(raceDate) : raceDate)
);

/**
 * Display form of a season - "2025/2026".
 * @param {number} seasonId
 * @returns {string}
 */
export const formatSeason = (seasonId) => SEASON_CONFIG.formatSeason(seasonId);

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
  getCurrentSeasonId,
  getSeasonIdForRace,
  formatSeason,
  generateRaceNumber
};
