import { useCallback, useEffect, useRef, useState } from 'react';

export const POLL_MS = 5000;

/**
 * Živý přenos z GET /races/live, obnova každých 5 s (ve skryté záložce se
 * nestahuje). status:
 * - loading: první načtení
 * - live: závod běží (data); stale = poslední pokus selhal, data jsou starší
 * - calm: nic neběží a v téhle návštěvě ani neběželo (404)
 * - ended: závod během sledování skončil (404 po datech)
 * - error: spojení selhalo dřív, než přišla jakákoli data
 */
export function useLiveTiming() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [stale, setStale] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  // Poslední závod v téhle návštěvě – pro „Živé vysílání skončilo“
  const lastRaceRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/races/live', { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        lastRaceRef.current = { id: json.race_id, name: json.areal_name };
        setData(json);
        setStatus('live');
        setStale(false);
        setLastUpdate(new Date());
      } else {
        setData(null);
        setStale(false);
        setStatus(lastRaceRef.current ? 'ended' : 'calm');
      }
    } catch {
      // Výpadek sítě: poslední data zůstanou, ale stránka řekne, že nejsou živá.
      setStale(true);
      setStatus((current) => (current === 'loading' || current === 'error' ? 'error' : current));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { data, status, stale, lastUpdate, lastRace: lastRaceRef.current, refresh };
}

/** Nejbližší a poslední odjetý závod pro klidový stav (bez závodu nic). */
export function useCalmRaces(enabled) {
  const [races, setRaces] = useState({ next: null, last: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const first = (url) =>
      fetch(url)
        .then((response) => (response.ok ? response.json() : []))
        .then((list) => (Array.isArray(list) ? (list[0] ?? null) : null))
        .catch(() => null);
    Promise.all([first('/races/?upcoming=true'), first('/races/?past=true&limit=1')]).then(
      ([next, last]) => {
        if (!cancelled) setRaces({ next, last });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return races;
}
