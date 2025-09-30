// Season Utilities
import { SEASON_CONFIG } from '../config/constants.js';

/**
 * Získá aktuální season_id podle data
 * @param {Date} referenceDate - Referenční datum (výchozí: aktuální datum)
 * @returns {number} Season ID
 */
export const getCurrentSeasonId = (referenceDate = new Date()) => {
  return SEASON_CONFIG.getCurrentSeasonId(referenceDate);
};

/**
 * Vypočítá season_id pro zadané datum závodu
 * @param {string|Date} raceDate - Datum závodu
 * @returns {number} Season ID pro tento závod
 */
export const getSeasonIdForRace = (raceDate) => {
  const date = typeof raceDate === 'string' ? new Date(raceDate) : raceDate;
  return getCurrentSeasonId(date);
};

/**
 * Formátuje sezónu pro zobrazení (např. "2025/2026")
 * @param {number} seasonId - ID sezóny
 * @returns {string} Formátovaná sezóna
 */
export const formatSeason = (seasonId) => {
  return SEASON_CONFIG.formatSeason(seasonId);
};

/**
 * Vygeneruje číslo závodu na základě existujících závodů
 * @param {Array} existingRaces - Pole existujících závodů
 * @param {number} seasonId - ID sezóny pro kterou generujeme číslo
 * @returns {string} Číslo závodu ve formátu JMLP2025-XX
 */
export const generateRaceNumber = (existingRaces, seasonId) => {
  // Najdeme všechny závody v dané sezóně
  const seasonRaces = existingRaces.filter(race => race.season_id === seasonId);
  
  // Najdeme nejvyšší pořadové číslo v této sezóně
  const maxNumber = seasonRaces.reduce((max, race) => {
    if (race.raceNr && race.raceNr.startsWith(`JMLP${seasonId}-`)) {
      const number = parseInt(race.raceNr.split('-')[1]);
      return isNaN(number) ? max : Math.max(max, number);
    }
    return max;
  }, 0);
  
  // Nové číslo je o 1 vyšší
  const newNumber = maxNumber + 1;
  
  // Formátujeme s leading zero
  return `JMLP${seasonId}-${newNumber.toString().padStart(2, '0')}`;
};

/**
 * Získá období sezóny
 * @param {number} seasonId - ID sezóny
 * @returns {object} Objekt s start a end datem
 */
export const getSeasonPeriod = (seasonId) => {
  return SEASON_CONFIG.getSeasonPeriod(seasonId);
};

/**
 * Kontroluje, zda je zadaná sezóna aktuální
 * @param {number} seasonId - ID sezóny k ověření
 * @returns {boolean} True pokud je sezóna aktuální
 */
export const isCurrentSeason = (seasonId) => {
  return seasonId === getCurrentSeasonId();
};

/**
 * Získá všechny sezóny v rozsahu
 * @param {number} startSeason - Počáteční sezóna
 * @param {number} endSeason - Koncová sezóna (výchozí: aktuální)
 * @returns {Array} Pole objektů se sezónami
 */
export const getSeasonsList = (startSeason, endSeason = getCurrentSeasonId()) => {
  const seasons = [];
  for (let i = startSeason; i <= endSeason; i++) {
    seasons.push({
      id: i,
      label: formatSeason(i),
      period: getSeasonPeriod(i),
      isCurrent: isCurrentSeason(i)
    });
  }
  return seasons.reverse(); // Nejnovější první
};

/**
 * Validuje, zda datum patří do očekávané sezóny
 * @param {string|Date} raceDate - Datum závodu
 * @param {number} expectedSeasonId - Očekávané season_id
 * @returns {object} Výsledek validace
 */
export const validateSeasonForDate = (raceDate, expectedSeasonId) => {
  const calculatedSeasonId = getSeasonIdForRace(raceDate);
  const isValid = calculatedSeasonId === expectedSeasonId;
  
  return {
    isValid,
    calculatedSeasonId,
    expectedSeasonId,
    message: isValid 
      ? `Datum ${raceDate} správně patří do sezóny ${formatSeason(expectedSeasonId)}`
      : `Datum ${raceDate} patří do sezóny ${formatSeason(calculatedSeasonId)}, ne ${formatSeason(expectedSeasonId)}`
  };
};

export default {
  getCurrentSeasonId,
  getSeasonIdForRace,
  formatSeason,
  getSeasonPeriod,
  isCurrentSeason,
  getSeasonsList,
  validateSeasonForDate
};