import { useCallback, useEffect, useRef } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import ConflictDialogMessage from './ConflictDialogMessage.jsx';
import {
  buildTimeUpdate,
  calculateTimeSum,
  isSameDraft,
  normalizeDraft,
  parseStoredTime,
} from './timingRules.js';

/**
 * Volby dialogu při konfliktu 409. ConfirmDialog dává fokus první volbě, takže
 * Enter zvolí ji - a Enter mačká časoměřič při zápisu pořád. Dřív byla první
 * "Přepsat mojí hodnotou" a jeden stisk ve chvíli, kdy dialog vyskočil, tiše
 * přepsal čas uložený z jiného zařízení. Bezpečná volba proto musí zůstat první.
 */
export const CONFLICT_CHOICES = [
  { value: 'server', label: 'Ponechat hodnotu ze serveru', icon: 'cloud-download' },
  { value: 'overwrite', label: 'Přepsat mojí hodnotou', danger: true, icon: 'pencil' },
];

/**
 * Ukládání naměřených časů.
 *
 * Tři věci, které se sem nevešly náhodou a musí zůstat pohromadě:
 *
 *  - zápisy do jednoho řádku se řetězí (saveChainRef), aby si dva souběžné
 *    nepodrazily base_revision,
 *  - konflikt 409 se neřeší hláškou, ale dialogem se srovnáním hodnot; dokud
 *    je otevřený, další konflikt se jen ohlásí,
 *  - po každém úspěšném zápisu se přepíše draft, aby se posunula základna -
 *    jinak by se po obnovení stránky uložený čas tvářil jako zahozený.
 *
 * Refy chodí zvenčí: sdílí je obsluha inboxu, která zapisuje čas toutéž cestou.
 */
export function useTimeSaving({
  selectedRaceId,
  setStartList,
  setEditedTimes,
  setSaving,
  setMessage,
  confirm,
  persistDrafts,
  editedTimesRef,
  originalTimesRef,
  startListByIdRef,
  filteredListRef,
  activeRoundRef,
  hasWriteLockRef,
  savingEntriesRef,
  saveChainRef,
  saveEntryRef,
  conflictOpenRef,
  skipBlurRef,
  readOnlyMessage,
  hasWriteLock,
}) {
  const inputRefs = useRef({});
  const updateTime = useCallback((entryId, field, value) => {
    if (!hasWriteLockRef.current) return;
    setEditedTimes((prev) => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value }
    }));
  }, []);

  const registerInput = useCallback((entryId, field, element) => {
    inputRefs.current[`${entryId}-${field}`] = element;
  }, []);

  const applySavedEntryToStartList = useCallback((entryId, data) => {
    const time1 = parseStoredTime(data.time1);
    const time2 = parseStoredTime(data.time2);
    const timeSum = calculateTimeSum(data);
    const hasRevision = 'updated_at' in data;

    const patch = {
      time1,
      time2,
      dnf: Boolean(data.dnf),
      dns: Boolean(data.dns),
      dsq: Boolean(data.dsq),
      time_sum: timeSum,
    };

    // Mapa se aktualizuje rovnou, protože getEntryRevision z ní čte ještě
    // předtím, než React stihne promítnout setStartList.
    const cached = startListByIdRef.current[entryId];
    if (cached) {
      startListByIdRef.current = {
        ...startListByIdRef.current,
        [entryId]: { ...cached, ...patch, updated_at: hasRevision ? (data.updated_at ?? null) : cached.updated_at },
      };
    }

    setStartList((prev) => prev.map((entry) => (
      entry.id === entryId
        ? { ...entry, ...patch, updated_at: hasRevision ? (data.updated_at ?? null) : entry.updated_at }
        : entry
    )));
  }, []);

  const getEntryRevision = useCallback((entryId) => {
    const row = startListByIdRef.current[entryId];
    return (row && row.updated_at) || null;
  }, []);

  const focusInput = useCallback((entryId, field) => {
    const input = inputRefs.current[`${entryId}-${field}`];
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const focusNextInput = useCallback((entryId, field) => {
    const list = filteredListRef.current;
    const currentIndex = list.findIndex((entry) => entry.id === entryId);
    if (currentIndex === -1) return;

    if (field === 'time1') {
      if (activeRoundRef.current === 'both') {
        focusInput(entryId, 'time2');
        return;
      }
      if (currentIndex < list.length - 1) {
        focusInput(list[currentIndex + 1].id, 'time1');
      }
      return;
    }

    if (currentIndex < list.length - 1) {
      const nextField = activeRoundRef.current === '2' ? 'time2' : 'time1';
      focusInput(list[currentIndex + 1].id, nextField);
    }
  }, [focusInput]);

  const refetchEntry = useCallback(async (entryId) => {
    const fresh = await TimekeeperAPI.get(`/api/timekeeper/start-list/${entryId}`);
    if (!fresh || fresh.id == null) return null;
    setStartList((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, ...fresh } : entry)));
    startListByIdRef.current = {
      ...startListByIdRef.current,
      [entryId]: { ...(startListByIdRef.current[entryId] || {}), ...fresh },
    };
    return fresh;
  }, []);

  /**
   * Řešení 409. Obsluha musí vidět obě hodnoty vedle sebe - tiché přepsání
   * cizího času je ten druh chyby, který se pozná až po zveřejnění výsledků.
   */
  const resolveTimeConflict = useCallback(async (entryId, draft, errorText) => {
    if (conflictOpenRef.current) {
      setMessage({ type: 'warning', text: 'Nejprve vyřešte zobrazený konflikt, pak zkuste čas uložit znovu.' });
      return { ok: false, queued: false };
    }

    let fresh = null;
    try {
      fresh = await refetchEntry(entryId);
    } catch {
      fresh = null;
    }
    if (!fresh) {
      setMessage({
        type: 'danger',
        text: `Konflikt změny u záznamu #${entryId}: záznam se nepodařilo znovu načíst ze serveru. Zkuste to prosím znovu, jakmile bude spojení stabilní.`
      });
      return { ok: false, queued: false };
    }

    const mine = normalizeDraft(draft);
    const racerLabel = `${fresh.racer_surname || ''} ${fresh.racer_name || ''}`.trim() || `#${entryId}`;

    conflictOpenRef.current = true;
    let choice = null;
    try {
      choice = await confirm({
        title: 'Záznam byl mezitím změněn',
        message: <ConflictDialogMessage racerLabel={racerLabel} mine={mine} fresh={fresh} />,
        choices: CONFLICT_CHOICES,
      });
    } finally {
      conflictOpenRef.current = false;
    }

    if (choice === 'overwrite') {
      return saveEntryRef.current
        ? saveEntryRef.current(entryId, draft, errorText, { forceApply: true })
        : { ok: false, queued: false };
    }

    if (choice === 'server') {
      const serverDraft = {
        time1: fresh.time1 != null ? String(fresh.time1) : '',
        time2: fresh.time2 != null ? String(fresh.time2) : '',
        dnf: Boolean(fresh.dnf),
        dns: Boolean(fresh.dns),
        dsq: Boolean(fresh.dsq),
      };
      originalTimesRef.current[entryId] = { ...serverDraft };
      editedTimesRef.current = { ...editedTimesRef.current, [entryId]: serverDraft };
      setEditedTimes((prev) => ({ ...prev, [entryId]: serverDraft }));
      persistDrafts();
      setMessage({ type: 'info', text: `Ponechána hodnota ze serveru u závodníka ${racerLabel}.` });
      return { ok: false, queued: false };
    }

    setMessage({
      type: 'warning',
      text: `Konflikt u závodníka ${racerLabel} zatím nevyřešen. Hodnota na serveru byla načtena – uložte znovu, nebo ji ponechte.`
    });
    return { ok: false, queued: false };
  }, [refetchEntry, confirm, persistDrafts]);

  const saveEntry = useCallback(async (entryId, draft, errorText, { forceApply = false } = {}) => {
    if (!draft) return { ok: false, queued: false };
    if (!hasWriteLockRef.current) {
      setMessage({ type: 'warning', text: readOnlyMessage });
      return { ok: false, queued: false };
    }

    try {
      savingEntriesRef.current.add(entryId);
      const result = await TimekeeperAPI.put(
        `/api/timekeeper/start-list/${entryId}/time`,
        buildTimeUpdate({ ...draft, base_revision: getEntryRevision(entryId), force_apply: forceApply })
      );
      applySavedEntryToStartList(entryId, {
        ...draft,
        updated_at: result?.revision || getEntryRevision(entryId),
      });
      // Uložením se posunula základna, takže se draft musí přepsat - jinak by
      // příští načtení hlásilo zahozený čas o čase, který je ve skutečnosti uložený.
      originalTimesRef.current[entryId] = { ...draft };
      persistDrafts();
      return {
        ok: true,
        queued: Boolean(result?.queued),
        opId: result?.op_id ?? null,
        queueId: result?.queue_id ?? null,
      };
    } catch (err) {
      if (!(err?.status === 409 && !forceApply)) {
        setMessage({ type: 'danger', text: errorText });
        return { ok: false, queued: false };
      }
    } finally {
      savingEntriesRef.current.delete(entryId);
    }

    return resolveTimeConflict(entryId, draft, errorText);
  }, [applySavedEntryToStartList, getEntryRevision, persistDrafts, resolveTimeConflict]);

  const queueSave = useCallback((entryId, draft, errorText, options = {}) => {
    const chain = saveChainRef.current;
    const next = (chain.get(entryId) || Promise.resolve())
      .catch(() => {})
      .then(() => saveEntry(entryId, draft, errorText, options));
    chain.set(entryId, next);
    next.catch(() => {}).then(() => {
      if (chain.get(entryId) === next) chain.delete(entryId);
    });
    return next;
  }, [saveEntry]);

  // Konflikt volá zpět zápis; přes ref, aby se obě useCallback nezacyklily.
  useEffect(() => { saveEntryRef.current = saveEntry; }, [saveEntry]);

  const saveFlagUpdate = useCallback(async (entryId, draft) => {
    if (!draft) return;
    await queueSave(entryId, draft, 'Nepodařilo se uložit stav');
  }, [queueSave]);

  const toggleFlag = useCallback((entryId, flag) => {
    if (!hasWriteLockRef.current) {
      setMessage({ type: 'warning', text: readOnlyMessage });
      return;
    }
    setEditedTimes((prev) => {
      const updated = { ...prev[entryId], [flag]: !prev[entryId]?.[flag] };
      // Ukládá se rovnou z nové hodnoty, ne ze stavu - ten je v tuhle chvíli starý.
      saveFlagUpdate(entryId, updated);
      return { ...prev, [entryId]: updated };
    });
  }, [saveFlagUpdate]);

  const saveAllTimes = async () => {
    if (!selectedRaceId) return;
    if (!hasWriteLock) {
      setMessage({ type: 'warning', text: readOnlyMessage });
      return;
    }
    try {
      setSaving(true);
      const changedEntries = Object.entries(editedTimesRef.current)
        .filter(([id, data]) => !isSameDraft(data, originalTimesRef.current[id]))
        .map(([id, data]) => ({ id: parseInt(id), data }));

      if (changedEntries.length === 0) {
        setMessage({ type: 'info', text: 'Žádné změny k uložení.' });
        return;
      }

      const entries = changedEntries.map(({ id, data }) => ({
        entry_id: id,
        base_revision: getEntryRevision(id),
        force_apply: false,
        ...normalizeDraft(data),
      }));

      const result = await TimekeeperAPI.post(`/api/timekeeper/races/${selectedRaceId}/times`, { entries });
      const revisions = result?.revisions && typeof result.revisions === 'object' ? result.revisions : null;

      changedEntries.forEach(({ id, data }) => {
        // Bez mapy revizí se řádek raději nechá bez razítka: cizí revize je
        // jistý 409 při dalším zápisu, prázdná znamená jen "zeptej se serveru".
        const revision = revisions
          ? (revisions[id] ?? revisions[String(id)] ?? null)
          : (result?.queued ? getEntryRevision(id) : null);
        applySavedEntryToStartList(id, { ...data, updated_at: revision });
        originalTimesRef.current[id] = { ...data };
      });
      persistDrafts();
      setMessage({ type: 'success', text: result.message });
    } catch (err) {
      const staleEntryId = Number(err?.detail?.entry_id);
      if (err?.status === 409 && Number.isFinite(staleEntryId) && editedTimesRef.current[staleEntryId]) {
        setSaving(false);
        await resolveTimeConflict(staleEntryId, editedTimesRef.current[staleEntryId], 'Nepodařilo se uložit časy');
        setMessage({
          type: 'warning',
          text: 'Dávka nebyla uložena kvůli konfliktu u jednoho záznamu. Po jeho vyřešení stiskněte „Uložit vše“ znovu.'
        });
        return;
      }
      const conflictMessage = err?.status === 409
        ? `Konflikt dávky: záznam ${Number.isFinite(staleEntryId) ? `#${staleEntryId}` : ''} byl mezitím upraven.`.trim()
        : 'Nepodařilo se uložit časy';
      setMessage({ type: 'danger', text: conflictMessage });
    } finally {
      setSaving(false);
    }
  };

  const saveSingleTime = useCallback(async (entryId) => {
    if (!hasWriteLockRef.current) return { ok: false, queued: false };
    const draft = editedTimesRef.current[entryId];
    if (!draft) return { ok: false, queued: false };
    return queueSave(entryId, draft, 'Nepodařilo se uložit čas');
  }, [queueSave]);

  const handleBlur = useCallback((entryId, field) => {
    if (!hasWriteLockRef.current) return;
    const blurKey = `${entryId}-${field}`;
    if (skipBlurRef.current === blurKey) {
      skipBlurRef.current = null;
      return;
    }
    saveSingleTime(entryId);
  }, [saveSingleTime]);

  const handleKeyDown = useCallback(async (e, entryId, field) => {
    if (!hasWriteLockRef.current) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      if (field === 'time1' && activeRoundRef.current === 'both') {
        focusInput(entryId, 'time2');
      } else {
        focusNextInput(entryId, field);
      }
    }

    if (e.key === 'Tab' && !e.shiftKey && field === 'time1') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      focusNextInput(entryId, field);
    }

    if (e.key === 'Tab' && !e.shiftKey && field === 'time2') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      focusNextInput(entryId, field);
    }
  }, [saveSingleTime, focusInput, focusNextInput]);

  return {
    updateTime,
    registerInput,
    queueSave,
    toggleFlag,
    saveAllTimes,
    handleBlur,
    handleKeyDown,
  };
}
