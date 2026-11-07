import { useCallback, useEffect, useState } from 'react';
import { useRevalidateOnFocus } from './useRevalidateOnFocus.js';

/** Výsledky sezón z /season-results/ podle roku začátku sezóny. */
const bySeason = (results) => Object.fromEntries(results.map((result) => [result.season_year_start, result]));

/**
 * Data kalendáře: všechny závody a zveřejněné výsledky sezón.
 * status: loading | error | ready. Selhání /season-results/ kalendář
 * neshodí – sezóna pak jen nemá tlačítko výsledků.
 */
export function useRaceCalendar() {
  const [races, setRaces] = useState([]);
  const [seasonResults, setSeasonResults] = useState({});
  const [status, setStatus] = useState('loading');

  // silent: obnova na pozadí – bez načítání a bez chyby přes kalendář, který už je vidět
  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    return Promise.all([
      fetch('/races/').then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }),
      fetch('/season-results/').then((response) => response.json()).catch(() => []),
    ]).then(([raceData, resultData]) => {
      setRaces(raceData);
      setSeasonResults(bySeason(Array.isArray(resultData) ? resultData : []));
      setStatus('ready');
    }).catch(() => {
      if (!silent) setStatus('error');
    });
  }, []);

  useEffect(() => { load(); }, [load]);
  useRevalidateOnFocus(() => load({ silent: true }));

  return { races, seasonResults, status, reload: load };
}
