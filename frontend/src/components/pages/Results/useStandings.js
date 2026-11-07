import { useEffect, useState } from 'react';

/**
 * Pořadí poháru sezóny z GET /season-results/{id}/standings (stejný výpočet
 * jako náhled časomíry). status: loading | error | ready.
 */
export function useStandings(seasonId) {
  const [standings, setStandings] = useState(null);
  const [status, setStatus] = useState('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!seasonId) return undefined;
    let cancelled = false;
    setStatus('loading');
    fetch(`/season-results/${seasonId}/standings`)
      .then((response) => {
        // Sezóna bez záznamu v tabulce sezón: pořadí není, není to ale chyba spojení.
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setStandings(data);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [seasonId, retry]);

  return { standings, status, reload: () => setRetry((count) => count + 1) };
}
