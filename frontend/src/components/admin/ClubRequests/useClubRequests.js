import { useEffect, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';
import { EMPTY_RESOLVE, resolvePayload } from './clubRequests.js';

/**
 * Žádosti o přiřazení klubu: fronta, seznam klubů a stav řešení každé
 * žádosti. Po vyřízení se ohlásí událost `club-request-resolved` (počet
 * v menu administrace).
 */
export function useClubRequests() {
  const [requests, setRequests] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // registration_id -> { mode, clubId, newName }
  const [resolveState, setResolveState] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [reqs, cls] = await Promise.all([
          AdminAPI.get('/api/admin/clubs/requests'),
          AdminAPI.get('/api/admin/clubs/'),
        ]);
        setRequests(reqs);
        setClubs(cls);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const stateOf = (id) => resolveState[id] || EMPTY_RESOLVE;
  const update = (id, patch) => setResolveState((prev) => ({ ...prev, [id]: { ...(prev[id] || EMPTY_RESOLVE), ...patch } }));

  const resolve = async (registrationId) => {
    try {
      await AdminAPI.post(`/api/admin/clubs/requests/${registrationId}/resolve`, resolvePayload(stateOf(registrationId)));
      setRequests((prev) => prev.filter((r) => r.registration_id !== registrationId));
      setResolveState((prev) => { const next = { ...prev }; delete next[registrationId]; return next; });
      window.dispatchEvent(new CustomEvent('club-request-resolved'));
    } catch (err) {
      setError(`Žádost se nepodařilo vyřídit: ${err.message}`);
    }
  };

  return { requests, clubs, loading, error, setError, stateOf, update, resolve };
}
