import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AdminAPI } from '../../../config/api.js';

/**
 * Počet nevyřízených žádostí o přiřazení klubu (odznak v menu administrace).
 * Načte se při každé změně adresy a po události `club-request-resolved`,
 * kterou vyšle obrazovka Žádosti o kluby po vyřízení žádosti.
 */
export function useClubRequestCount() {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    AdminAPI.get('/api/admin/clubs/requests/count')
      .then((data) => setCount(data.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    window.addEventListener('club-request-resolved', refresh);
    return () => window.removeEventListener('club-request-resolved', refresh);
  }, [refresh]);

  return count;
}
