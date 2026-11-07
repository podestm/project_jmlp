import { useEffect, useSyncExternalStore } from 'react';
import { API } from '../config/api.js';
import { seasonEdition, seasonIdForDate } from '../utils/season.js';

/**
 * Aktuální sezóna – jedna pro celou aplikaci (hlavička webu, výchozí sezóna
 * kalendáře a výsledků, filtry administrace, časomíra). Volí ji správce
 * ve správě sezón, server ji vrací z /races/season/current.
 *
 * Načte se jednou za běh stránky a sdílí všechny komponenty. Do odpovědi
 * (a bez sítě) platí poslední známá hodnota z localStorage, jinak sezóna
 * podle data – časomíra tak má sezónu i offline.
 */

const STORAGE_KEY = 'jmlp_current_season';
const ENDPOINT = '/races/season/current';

const fromDate = () => {
  const seasonId = seasonIdForDate();
  return { seasonId, edition: seasonEdition(seasonId) };
};

const isSeason = (value) => Number.isInteger(value?.seasonId) && Number.isInteger(value?.edition);

const readStored = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isSeason(stored) ? stored : null;
  } catch {
    return null;
  }
};

let current = null;
let request = null;
const listeners = new Set();

const snapshot = () => {
  if (!current) current = readStored() ?? fromDate();
  return current;
};

const publish = (next) => {
  const prev = snapshot();
  if (prev.seasonId === next.seasonId && prev.edition === next.edition) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Bez úložiště (anonymní okno) se jen nezapamatuje do příště.
  }
  listeners.forEach((listener) => listener());
};

/**
 * Načte aktuální sezónu ze serveru (jednou; `force` znovu – po změně ve
 * správě sezón). Chyba se spolkne: platí dál poslední známá hodnota.
 */
export const loadCurrentSeason = ({ force = false } = {}) => {
  if (request && !force) return request;
  request = Promise.resolve()
    .then(() => API.get(ENDPOINT))
    .then((data) => {
      const seasonId = data?.current_season_id;
      if (!Number.isInteger(seasonId)) return;
      publish({
        seasonId,
        edition: Number.isInteger(data.edition) ? data.edition : seasonEdition(seasonId),
      });
    })
    .catch(() => {
      request = null; // příště to zkusí znovu
    });
  return request;
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** { seasonId, edition } aktuální sezóny; při prvním použití ji načte. */
export function useCurrentSeason() {
  useEffect(() => {
    loadCurrentSeason();
  }, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Jen pro testy: zapomene načtenou sezónu i rozběhnutý požadavek. */
export const resetCurrentSeason = () => {
  current = null;
  request = null;
};
