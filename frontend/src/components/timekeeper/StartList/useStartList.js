import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { ENTRY_REMAPPED_EVENT, remapEntriesInState } from '../../../offline/offlineEntries.js';
import { dropRaceSnapshot } from '../../../offline/startListCache.js';
import { clearTimingDrafts } from '../../../offline/timingDrafts.js';
import { useSyncStatus } from '../../../offline/useSyncStatus.js';
import { storeSelectedRaceId } from '../frame/selectedRace.js';
import {
  OFFLINE_QUEUED_TEXT,
  activeEntries,
  findRaceNumberOption,
  getRaceNumberValidationError,
  groupEntriesByCategory,
  isExcluded,
  sortStartListEntries,
} from '../startListHelpers.js';

/**
 * Startovní listina vybraného závodu: načtení, oprava řádku, odebrání,
 * vyřazení / vrácení a smazání celé listiny.
 *
 * Pravidla kolem startovních čísel a řazení jsou v `startListHelpers.js` -
 * stejná pravidla platí i na obrazovce Závodníci a rozcházet se nesmějí.
 *
 * `confirm` je z useConfirm obrazovky, `setMessage` hláška obrazovky.
 */
export const useStartList = (selectedRaceId, { confirm, setMessage }) => {
  const { isOnline, queueStats } = useSyncStatus();
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [raceNumberOptions, setRaceNumberOptions] = useState([]);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editValidationError, setEditValidationError] = useState('');

  // Drží aktuální loadStartList, aby mazání závodníka nemuselo být závislé
  // na startList - jinak by se při každém úhozu měnila identita callbacku
  // a memoizované řádky by se překreslovaly všechny.
  const loadStartListRef = useRef(null);

  const loadStartList = async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${selectedRaceId}/start-list`);
      setStartList(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };
  loadStartListRef.current = loadStartList;

  const loadRaceNumberOptions = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-options');
      setRaceNumberOptions(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst seznam závodních čísel' });
    }
  };

  useEffect(() => {
    if (selectedRaceId) {
      loadStartList();
      loadRaceNumberOptions();
      storeSelectedRaceId(selectedRaceId);
    }
  }, [selectedRaceId]);

  // Offline přidaný závodník: dostal serverové id (nebo byl zahozen), případně
  // ho právě přidala obrazovka Závodníci v jiné záložce.
  useEffect(() => {
    const onRemapped = (event) => {
      if (event?.detail) setStartList((prev) => sortStartListEntries(remapEntriesInState(prev, event.detail)));
    };
    window.addEventListener(ENTRY_REMAPPED_EVENT, onRemapped);
    return () => window.removeEventListener(ENTRY_REMAPPED_EVENT, onRemapped);
  }, []);

  /**
   * Smazání celé startovní listiny.
   *
   * Jen online a jen s prázdnou frontou: offline by se smazání přehrálo se
   * zpožděním a vzalo s sebou i to, co mezitím vzniklo, a čekající zápis času
   * by po smazání skončil chybou.
   */
  const clearStartList = async () => {
    if (!selectedRaceId) return;

    if (!isOnline) {
      setMessage({
        type: 'warning',
        text: 'Mazání startovní listiny vyžaduje připojení k internetu - offline by se smazání přehrálo až později.'
      });
      return;
    }
    if (queueStats.total > 0) {
      setMessage({
        type: 'warning',
        text: `Ve frontě čeká ${queueStats.total} nesynchronizovaných změn. Nechte je nejdřív odeslat (Synchronizace).`
      });
      return;
    }

    const measured = startList.filter(
      (entry) => entry.time1 != null || entry.time2 != null || entry.dnf || entry.dns || entry.dsq
    ).length;

    const confirmed = await confirm({
      title: 'Smazat celou startovní listinu?',
      message: `Smaže se všech ${startList.length} závodníků včetně přidělených startovních čísel a dresů`
        + (measured > 0 ? ` a naměřených časů (${measured} závodníků už má výsledek)` : '')
        + '. Listinu půjde znovu vygenerovat z přihlášek. Akce je nevratná.',
      confirmLabel: 'Smazat vše',
      danger: true,
      icon: 'trash',
    });
    if (!confirmed) return;
    try {
      const result = await TimekeeperAPI.deleteOnline(
        `/api/timekeeper/races/${selectedRaceId}/start-list`
      );
      // Nakešovaná startovka i rozepsané časy musí zmizet s ní - jinak si je
      // obrazovka Zadávání časů offline načte jako platné.
      await dropRaceSnapshot(selectedRaceId);
      await clearTimingDrafts(selectedRaceId);
      setMessage({ type: 'info', text: result.message });
      setStartList([]);
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.message || 'Nepodařilo se smazat startovní listinu'
      });
    }
  };

  // --- Inline editing ---
  const startEditing = useCallback((entry) => {
    setEditingId(entry.id);
    setEditForm({
      start_number: entry.start_number || '',
      racer_name: entry.racer_name || '',
      racer_surname: entry.racer_surname || '',
      racer_year: entry.racer_year || '',
      racer_sex: entry.racer_sex || '',
      club_name: entry.club_name || '',
      race_number_display: entry.race_number_display || '',
    });
    setEditValidationError('');
  }, []);

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
    setEditValidationError('');
  };

  const updateEditField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    if (field === 'race_number_display') setEditValidationError('');
  };

  const validateRaceNumber = useCallback((displayNumber, excludeEntryId = null) => (
    getRaceNumberValidationError(displayNumber, {
      options: raceNumberOptions,
      entries: startList,
      excludeEntryId,
    })
  ), [raceNumberOptions, startList]);

  const saveEditing = async () => {
    if (!editingId) return;

    const raceNumberError = validateRaceNumber(editForm.race_number_display, editingId);
    if (raceNumberError) {
      setEditValidationError(raceNumberError);
      return;
    }

    try {
      const body = {};
      if (editForm.start_number !== '') body.start_number = parseInt(editForm.start_number);
      body.racer_name = editForm.racer_name?.trim() || null;
      body.racer_surname = editForm.racer_surname?.trim() || null;
      body.club_name = editForm.club_name?.trim() || null;
      body.racer_year = editForm.racer_year !== '' && editForm.racer_year !== null && editForm.racer_year !== undefined
        ? parseInt(editForm.racer_year)
        : null;
      body.race_number_display = editForm.race_number_display !== '' ? parseInt(editForm.race_number_display) : null;

      const result = await TimekeeperAPI.put(`/api/timekeeper/start-list/${editingId}`, body);
      if (result?.entry) {
        setStartList(prev => sortStartListEntries(prev.map(entry => (
          entry.id === editingId ? result.entry : entry
        ))));
      } else {
        // Offline: požadavek leží ve frontě a žádný `entry` se nevrátil, takže
        // řádek přepíšeme tím, co jsme odeslali, a označíme ho jako nesynchronizovaný.
        setStartList(prev => sortStartListEntries(prev.map(entry => (
          entry.id === editingId ? { ...entry, ...body, pending_sync: true } : entry
        ))));
        setMessage({ type: 'info', text: result?.message || OFFLINE_QUEUED_TEXT });
      }
      setEditingId(null);
      setEditForm({});
      setEditValidationError('');
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se uložit změny' });
    }
  };

  const deleteEntry = useCallback(async (entryId, name) => {
    const confirmed = await confirm({
      title: `Odebrat ${name} ze startovní listiny?`,
      confirmLabel: 'Odebrat',
      danger: true,
      icon: 'trash',
    });
    if (!confirmed) return;
    try {
      await TimekeeperAPI.delete(`/api/timekeeper/start-list/${entryId}`);
      await loadStartListRef.current();
      setMessage({ type: 'info', text: `${name} odebrán/a ze startovní listiny` });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se odebrat závodníka' });
    }
  }, [confirm, setMessage]);

  /**
   * Vyřazení ze startky / vrácení zpět (nedorazil, nestihl start).
   *
   * Jde přes offline frontu jako každá jiná úprava startovky: bez signálu se
   * změna uloží v zařízení a obrazovky (Časy, tisk) ji vidí hned. Posílá se
   * cílový stav, ne přepínač, takže opakovaná přehrávka nic neotočí.
   */
  const toggleExcluded = useCallback(async (entry) => {
    const excluded = !isExcluded(entry);
    const name = `${entry.racer_surname} ${entry.racer_name}`.trim();
    try {
      const result = await TimekeeperAPI.put(`/api/timekeeper/start-list/${entry.id}/excluded`, { excluded });
      if (result?.entry) {
        setStartList(prev => prev.map(item => (item.id === entry.id ? result.entry : item)));
        setMessage({
          type: 'info',
          text: excluded
            ? `${name} vyřazen/a ze startovní listiny. Vrátit jde tlačítkem Vrátit.`
            : `${name} vrácen/a na startovní listinu.`
        });
      } else {
        // Offline: zápis čeká ve frontě a řádek se upraví podle odeslaného stavu.
        setStartList(prev => prev.map(item => (
          item.id === entry.id ? { ...item, excluded, pending_sync: true } : item
        )));
        setMessage({ type: 'info', text: result?.message || OFFLINE_QUEUED_TEXT });
      }
    } catch {
      setMessage({
        type: 'danger',
        text: excluded ? `Nepodařilo se vyřadit ${name}` : `Nepodařilo se vrátit ${name}`
      });
    }
  }, [setMessage]);

  const liveEditRaceNumberError = useMemo(() => (
    editingId ? validateRaceNumber(editForm.race_number_display, editingId) : ''
  ), [editingId, editForm.race_number_display, validateRaceNumber]);

  // Vyřazení zůstávají v tabulce své kategorie - jen tady se dají vrátit.
  // Počty jsou za ty, kdo na startovce opravdu jsou; vyřazení se hlásí zvlášť.
  const groupedByCategory = useMemo(() => groupEntriesByCategory(startList).map((group) => {
    const groupActiveCount = activeEntries(group.entries).length;
    return { ...group, activeCount: groupActiveCount, excludedCount: group.entries.length - groupActiveCount };
  }), [startList]);
  const activeCount = useMemo(() => activeEntries(startList).length, [startList]);

  /** Číslo dresu, které by řádek po uložení systémového čísla dostal. */
  const editBibNumber = (entry) => (
    findRaceNumberOption(raceNumberOptions, editForm.race_number_display)?.actual_number ?? entry.race_number_actual
  );

  return {
    startList,
    loading,
    loadStartList,
    clearStartList,
    deleteEntry,
    toggleExcluded,
    groupedByCategory,
    activeCount,
    excludedCount: startList.length - activeCount,
    // oprava řádku
    editingId,
    editForm,
    updateEditField,
    startEditing,
    cancelEditing,
    saveEditing,
    editError: liveEditRaceNumberError || editValidationError,
    editBibNumber,
  };
};
