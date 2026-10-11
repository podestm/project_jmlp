import { useCallback, useEffect, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';
import { useRevalidateOnFocus } from '../../../hooks/useRevalidateOnFocus.js';

/**
 * Čísla přehledu administrace: { data, loading, error, reload }.
 * Obnova po návratu do záložky je tichá – bez spinneru a bez chybové
 * hlášky přes čísla, která už na obrazovce jsou.
 */
export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const result = await AdminAPI.get('/api/admin/dashboard/stats');
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRevalidateOnFocus(() => load({ silent: true }));

  return { data, loading, error, reload: () => load() };
}
