import { useCallback, useEffect, useState } from 'react';
import { useRevalidateOnFocus } from '../../../hooks/useRevalidateOnFocus.js';

/**
 * Závod pro detail. status: loading | notFound (404 – špatný odkaz) |
 * error (server neodpověděl – zkusit znovu) | ready. Obnova po návratu do
 * záložky jde potichu a chybou nepřepíše detail, který už je vidět.
 */
export function useRaceDetail(raceId) {
  const [race, setRace] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setStatus('loading');
      try {
        const response = await fetch(`/races/${raceId}`);
        if (response.status === 404) {
          if (!silent) setStatus('notFound');
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data) {
          if (!silent) setStatus('notFound');
          return;
        }
        setRace(data);
        setStatus('ready');
      } catch {
        if (!silent) setStatus('error');
      }
    },
    [raceId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { race, status, reload: load };
}

/**
 * Nadcházející závody (od nejbližšího) – detail z nich nabízí, kam jít dál,
 * když se na tenhle závod přihlásit nedá. Selhání nevadí: nabídka se jen
 * nezobrazí.
 */
export function useUpcomingRaces(enabled) {
  const [races, setRaces] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetch('/races/?upcoming=true')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setRaces(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return races;
}

/**
 * Seznam přihlášených (GET /races/{id}/registrations). Načte se znovu při
 * každé změně refreshToken (po přihlášce, po návratu do záložky).
 * status: idle (vypnuto) | loading | error | ready.
 */
export function useRaceRegistrations(raceId, { enabled = true, refreshToken = 0 } = {}) {
  const [registrations, setRegistrations] = useState(null);
  const [status, setStatus] = useState('idle');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled || !raceId) {
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
    fetch(`/races/${raceId}/registrations`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRegistrations(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [raceId, enabled, refreshToken, retry]);

  return { registrations, status, reload: () => setRetry((count) => count + 1) };
}

/** Obnova detailu i seznamu po návratu do záložky. */
export function useRaceDetailRevalidation(reloadRace, bumpRegistrations) {
  useRevalidateOnFocus(() => {
    reloadRace({ silent: true });
    bumpRegistrations();
  });
}
