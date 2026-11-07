import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAPI } from '../../../config/api.js';
import { useRevalidateOnFocus } from '../../../hooks/useRevalidateOnFocus.js';
import { deletedMessage, filterClubs, PLATNOST } from './clubs.js';

/**
 * Data a akce správy klubů: přehled s počty, filtry, rozbalené logo
 * a mazání s převodem závodníků i pořádaných závodů na jiný klub.
 */
export function useClubManagement() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState('');
  const [onlyOrganizers, setOnlyOrganizers] = useState(false);
  const [platnost, setPlatnost] = useState(PLATNOST.vse);
  const [expandedClub, setExpandedClub] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // silent: obnova na pozadí - bez spinneru a bez chybové hlášky přes seznam,
  // který už na obrazovce je
  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setClubs(await AdminAPI.get('/api/admin/clubs/overview'));
    } catch (err) {
      if (!silent) setMessage({ type: 'danger', text: err.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  // Při otevřeném dialogu mazání se seznam pod ním neobnovuje
  useRevalidateOnFocus(() => load({ silent: true }), { enabled: !deleting });

  const deleteClub = useCallback(
    async (club, targetId) => {
      try {
        const result = await AdminAPI.delete(
          `/api/admin/clubs/${club.id}`,
          {},
          targetId ? { reassign_to: targetId } : {},
        );
        setMessage({ type: 'success', text: deletedMessage(result) });
        setExpandedClub((open) => (open === club.id ? null : open));
        await load();
      } catch (err) {
        setMessage({ type: 'danger', text: err.message });
      }
    },
    [load],
  );

  /** Výsledek dialogu: false = zrušeno, jinak id cílového klubu nebo null. */
  const resolveDelete = (target) => {
    const club = deleting;
    setDeleting(null);
    if (target !== false) deleteClub(club, target);
  };

  const visibleClubs = useMemo(
    () => filterClubs(clubs, { query, onlyOrganizers, platnost }),
    [clubs, query, onlyOrganizers, platnost],
  );

  const resetFilters = () => {
    setQuery('');
    setOnlyOrganizers(false);
    setPlatnost(PLATNOST.vse);
  };

  return {
    clubs,
    visibleClubs,
    loading,
    message,
    setMessage,
    load,
    query,
    setQuery,
    onlyOrganizers,
    setOnlyOrganizers,
    platnost,
    setPlatnost,
    resetFilters,
    filtersActive: Boolean(query) || onlyOrganizers || platnost !== PLATNOST.vse,
    expandedClub,
    toggleLogo: (club) => setExpandedClub((open) => (open === club.id ? null : club.id)),
    deleting,
    requestDelete: setDeleting,
    resolveDelete,
  };
}
