import { TimekeeperAPI } from '../config/timekeeperApi.js';
import { isOnline } from './connectivity.js';

/**
 * Data vybraného závodu, která potřebují obrazovky časomíry, se uloží do
 * IndexedDB hned po výběru závodu (a znovu po návratu signálu) – ne až při
 * první návštěvě obrazovky. Detail závodu, startovka i výsledky pak jdou
 * otevřít bez signálu, i když se online vůbec neotevřely.
 */
export const raceEndpoints = (raceId) => [
  '/api/timekeeper/races',
  `/api/timekeeper/races/${raceId}/detail`,
  `/api/timekeeper/races/${raceId}/start-list`,
  `/api/timekeeper/races/${raceId}/results`,
  '/api/timekeeper/race-number-sets',
];

export const preloadRaceData = async (raceId) => {
  if (!raceId) return;
  if (!isOnline()) return;
  await Promise.allSettled(raceEndpoints(raceId).map((endpoint) => TimekeeperAPI.get(endpoint)));
};
