import { useCallback, useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';

/**
 * Závody pro výběr v časomíře a přepínání živého přenosu. Seznam jde přes
 * TimekeeperAPI, takže offline se vezme z keše notebooku.
 */
export const useTimekeeperRaces = () => {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRaces = useCallback(async () => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
      setError('');
    } catch (err) {
      setError('Nepodařilo se načíst závody');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRaces();
  }, [loadRaces]);

  const toggleLive = useCallback(
    async (raceId) => {
      try {
        await TimekeeperAPI.put(`/api/timekeeper/races/${raceId}/live`, {});
        await loadRaces();
      } catch (err) {
        console.error('Nepodařilo se změnit live stav:', err);
        setError(`Nepodařilo se změnit live stav: ${err.detail || err.message || 'Neznámá chyba'}`);
      }
    },
    [loadRaces],
  );

  return { races, loading, error, clearError: () => setError(''), loadRaces, toggleLive };
};
