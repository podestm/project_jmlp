import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAPI } from '../../../../config/api.js';
import { PAIR_STATUS, bulkConfirmable, filterPairs } from './slcrPairing.js';

const POLL_MS = 3000;

/**
 * Data a akce obrazovky Párování se SLČR: souhrn (počty, běh načítání),
 * řádky vybrané záložky, hledání a jistota, rozhodnutí po řádcích
 * a hromadné potvrzení / převzetí údajů z evidence.
 */
export function useSlcrPairing() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(PAIR_STATUS.suggested);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [confidence, setConfidence] = useState('all');
  const [scope, setScope] = useState('active');
  const [busy, setBusy] = useState({});
  const [bulk, setBulk] = useState(null);
  const [message, setMessage] = useState(null);

  const loadSummary = useCallback(async () => {
    const data = await AdminAPI.get('/api/admin/slcr/summary');
    setSummary(data);
    return data;
  }, []);

  const loadItems = useCallback(async (nextStatus) => {
    setLoading(true);
    try {
      setItems(await AdminAPI.get('/api/admin/slcr/pairs', { status: nextStatus }));
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary().catch((err) => setMessage({ type: 'danger', text: err.message }));
  }, [loadSummary]);

  useEffect(() => { loadItems(status); }, [status, loadItems]);

  // Během načítání ze SLČR sledujeme průběh; po doběhnutí obnovíme tabulku.
  const running = Boolean(summary?.running);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(async () => {
      try {
        const data = await loadSummary();
        if (!data.running) {
          loadItems(status);
          if (data.job?.error) setMessage({ type: 'danger', text: `Načítání ze SLČR selhalo: ${data.job.error}` });
          else setMessage({ type: 'success', text: 'Návrhy ze SLČR jsou načtené.' });
        }
      } catch {
        // Další pokus za chvíli.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, loadSummary, loadItems, status]);

  const startSync = async () => {
    try {
      await AdminAPI.post('/api/admin/slcr/sync', { scope });
      setMessage(null);
      await loadSummary();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const decide = useCallback(async (item, action) => {
    setBusy((prev) => ({ ...prev, [item.racer_id]: action }));
    try {
      await AdminAPI.post(`/api/admin/slcr/pairs/${item.racer_id}/${action}`, {});
      setItems((prev) => prev.filter((other) => other.racer_id !== item.racer_id));
      loadSummary();
    } catch (err) {
      setMessage({ type: 'danger', text: `${item.racer.surname} ${item.racer.name}: ${err.message}` });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[item.racer_id];
        return next;
      });
    }
  }, [loadSummary]);

  const visible = useMemo(() => filterPairs(items, { query, confidence }), [items, query, confidence]);
  const confirmable = useMemo(() => bulkConfirmable(visible), [visible]);

  const confirmAllSure = async () => {
    setBulk({ done: 0, total: confirmable.length });
    let failed = 0;
    for (const [index, item] of confirmable.entries()) {
      try {
        await AdminAPI.post(`/api/admin/slcr/pairs/${item.racer_id}/confirm`, {});
      } catch {
        failed += 1;
      }
      setBulk({ done: index + 1, total: confirmable.length });
    }
    setBulk(null);
    setMessage(failed
      ? { type: 'warning', text: `Potvrzeno ${confirmable.length - failed}, ${failed} se nepodařilo - zkontrolujte je jednotlivě.` }
      : { type: 'success', text: `Potvrzeno ${confirmable.length} jistých shod.` });
    loadItems(status);
    loadSummary();
  };

  const applyConfirmed = async () => {
    setBulk({ done: 0, total: summary?.counts?.pending_apply || 0 });
    try {
      const result = await AdminAPI.post('/api/admin/slcr/apply-confirmed', {});
      const failed = result.failed || [];
      setMessage(failed.length
        ? { type: 'warning', text: `Opraveno ${result.changed} záznamů; ${failed.length} se nepodařilo: ${failed.map((f) => f.reason).join(' | ')}` }
        : { type: 'success', text: `Opraveno ${result.changed} záznamů podle evidence.` });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setBulk(null);
      loadItems(status);
      loadSummary();
    }
  };

  return {
    summary,
    counts: summary?.counts || {},
    job: summary?.job,
    running,
    status,
    setStatus,
    items,
    visible,
    confirmable,
    loading,
    query,
    setQuery,
    confidence,
    setConfidence,
    scope,
    setScope,
    busy,
    bulk,
    message,
    clearMessage: () => setMessage(null),
    startSync,
    decide,
    confirmAllSure,
    applyConfirmed,
  };
}
