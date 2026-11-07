import { useCallback, useEffect, useState } from 'react';
import { AdminAPI } from '../../../../config/api.js';

/** Denní návštěvy za posledních `days` dní: { rows, loading, error, reload }. */
export function useVisitsChart(days) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AdminAPI.get(`/api/admin/dashboard/visits-chart?days=${days}`);
      setRows(data);
      setError(null);
    } catch (err) {
      console.error('Chyba při načítání statistik:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load };
}
