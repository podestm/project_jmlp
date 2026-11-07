import { useCallback, useEffect, useState } from 'react';
import API, { API_CONFIG } from '../../../config/api.js';
import { useRevalidateOnFocus } from '../../../hooks/useRevalidateOnFocus.js';

/** Načte data jednoho bloku úvodu; status: loading | error | ready. */
function useBlock(fetcher) {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('loading');

  // silent: obnova na pozadí – chyba nepřepíše to, co už je vidět
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus('loading');
    try {
      const result = await fetcher();
      setData(Array.isArray(result) ? result : []);
      setStatus('ready');
    } catch {
      if (!silent) setStatus('error');
    }
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);
  return { data, status, load };
}

const fetchPosts = () => API.get(API_CONFIG.ENDPOINTS.POSTS, { limit: 3 });
const fetchRaces = () => API.get(API_CONFIG.ENDPOINTS.RACES, { current_season: true });

/**
 * Úvod: tři nejnovější aktuality a závody aktuální sezóny. Každý blok má
 * vlastní načítání a chybu – výpadek jednoho neschová druhý a selhání
 * závodů už nevypadá jako „žádné závody“.
 */
export function useHome() {
  const posts = useBlock(fetchPosts);
  const races = useBlock(fetchRaces);

  useRevalidateOnFocus(() => {
    posts.load({ silent: true });
    races.load({ silent: true });
  });

  return { posts, races };
}
