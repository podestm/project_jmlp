import { useCallback, useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { onBackOnline } from '../../../offline/connectivity.js';
import { toForm, toPayload } from './raceHeader.js';

/**
 * Načtení a uložení údajů hlavičky vybraného závodu. GET se ukládá do
 * IndexedDB (hlavička je i offline), PUT jde offline do fronty.
 */
export const useRaceHeader = (raceId) => {
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!raceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${raceId}/detail`);
      setDetail(data);
      setForm(toForm(data));
      setUnavailable(false);
    } catch {
      // Bez signálu a bez uložené kopie: obrazovka řekne proč (místo věčného
      // „Načítám“) a po návratu signálu se načte sama.
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [raceId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);
  useEffect(() => {
    if (!unavailable) return undefined;
    return onBackOnline(loadDetail);
  }, [unavailable, loadDetail]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const setRunField = (runNumber, field, value) => {
    setForm((prev) => ({
      ...prev,
      runs: prev.runs.map((run) =>
        run.run_number === runNumber ? { ...run, [field]: value } : run,
      ),
    }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const updated = await TimekeeperAPI.put(
        `/api/timekeeper/races/${raceId}/detail`,
        toPayload(form),
      );
      setDetail(updated);
      setMessage({ type: 'success', text: 'Údaje závodu uloženy' });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Uložení se nezdařilo' });
    } finally {
      setSaving(false);
    }
  };

  return {
    detail,
    form,
    loading,
    saving,
    message,
    clearMessage: () => setMessage(null),
    unavailable,
    reload: loadDetail,
    setField,
    setRunField,
    save,
  };
};
