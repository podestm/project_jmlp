// Data vybraného závodu do zařízení dopředu.
//
// TimekeeperAPI.get kešuje jen to, co už jednou online načetl. Obrazovka,
// kterou obsluha poprvé otevře až na kopci bez signálu (typicky Detail
// závodu), by jinak neměla co ukázat. Proto se hned po výběru závodu - a pak
// po spuštění časomíry a po každém obnovení připojení - stáhne všechno, co
// obrazovky závodu čtou.
import { TimekeeperAPI } from '../config/timekeeperApi.js';

// Stejný klíč jako SELECTED_RACE_KEY v TimekeeperChrome.jsx (offline vrstva
// komponenty neimportuje).
const SELECTED_RACE_KEY = 'timekeeper_selected_race';

export const raceEndpoints = (raceId) => [
  '/api/timekeeper/races',
  `/api/timekeeper/races/${raceId}/detail`,
  `/api/timekeeper/races/${raceId}/start-list`,
  `/api/timekeeper/races/${raceId}/results`,
  '/api/timekeeper/race-number-sets',
];

/** Stáhne do keše data závodu; offline nebo bez závodu nedělá nic. */
export const preloadRaceData = async (raceId) => {
  if (!raceId) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  await Promise.allSettled(raceEndpoints(raceId).map((endpoint) => TimekeeperAPI.get(endpoint)));
};

/** Totéž pro závod vybraný v tomto zařízení. */
export const preloadSelectedRace = async () => {
  let raceId = '';
  try {
    raceId = localStorage.getItem(SELECTED_RACE_KEY) || '';
  } catch {
    raceId = '';
  }
  await preloadRaceData(raceId);
};
