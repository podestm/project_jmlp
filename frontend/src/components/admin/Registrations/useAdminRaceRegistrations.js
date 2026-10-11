import { useEffect, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';

/** Závod a jeho přihlášky – načtené najednou, při změně závodu znovu. */
export function useAdminRaceRegistrations(raceId) {
  const [race, setRace] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [raceData, registrationsData] = await Promise.all([
          AdminAPI.get(`/api/admin/races/${raceId}`),
          AdminAPI.get(`/api/admin/races/${raceId}/registrations`),
        ]);
        setRace(raceData);
        setRegistrations(registrationsData);
      } catch (err) {
        console.error('Error loading race registrations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [raceId]);

  return { race, registrations, loading, error };
}
