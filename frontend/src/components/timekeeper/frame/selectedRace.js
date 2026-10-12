import { useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { preloadRaceData } from '../../../offline/racePreload.js';

/**
 * Vybraný závod časomíry. Pamatuje si ho notebook (localStorage), takže
 * přežije zavření prohlížeče a sdílí se mezi kartami. Jediné místo, kde se
 * klíč čte a zapisuje.
 */
export const SELECTED_RACE_KEY = 'timekeeper_selected_race';

/** Událost v této kartě – jiné karty dostanou nativní 'storage'. */
const CHANGE_EVENT = 'timekeeper:selected-race';

export const readSelectedRaceId = () => {
  try {
    return localStorage.getItem(SELECTED_RACE_KEY) || '';
  } catch {
    return '';
  }
};

/** Uloží výběr a dá vědět rámci (přepínač závodu v horní liště). */
export const storeSelectedRaceId = (raceId) => {
  try {
    localStorage.setItem(SELECTED_RACE_KEY, raceId);
  } catch {
    // Soukromý režim / plné úložiště – výběr platí aspoň do obnovení stránky.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

/** Id vybraného závodu, živě podle změn v této i jiných kartách. */
export const useSelectedRaceId = () => {
  const [raceId, setRaceId] = useState(readSelectedRaceId);

  useEffect(() => {
    const refresh = () => setRaceId(readSelectedRaceId());
    const onStorage = (event) => {
      if (event.key === SELECTED_RACE_KEY) refresh();
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return raceId;
};

/**
 * Vybraný závod i s údaji ze seznamu závodů (offline z keše IndexedDB).
 * race je null, dokud není vybraný nebo načtený.
 */
export const useSelectedRace = () => {
  const raceId = useSelectedRaceId();
  const [races, setRaces] = useState([]);

  useEffect(() => {
    if (!raceId) return undefined;
    let cancelled = false;
    TimekeeperAPI.get('/api/timekeeper/races')
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setRaces(data);
      })
      .catch(() => {
        // Bez sítě a bez keše – lišta ukáže jen výzvu k výběru.
      });
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  // Data závodu do zařízení hned po výběru a po návratu signálu – obrazovky
  // pak fungují offline, i když se online neotevřely.
  useEffect(() => {
    if (!raceId) return undefined;
    const preload = () => { preloadRaceData(raceId).catch(() => {}); };
    preload();
    window.addEventListener('online', preload);
    return () => window.removeEventListener('online', preload);
  }, [raceId]);

  const race = raceId ? races.find((item) => String(item.id) === String(raceId)) || null : null;
  return { raceId, race };
};
