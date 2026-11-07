import { useEffect, useMemo, useState } from 'react';
import { TimekeeperAPI } from '../../../config/timekeeperApi.js';
import { downloadBackup, importBackupPayload } from '../../../offline/backup.js';
import { getOpenConflicts, getRecentQueueItems, resolveConflict, retryQueueItem } from '../../../offline/syncQueue.js';
import { useSyncStatus } from '../../../offline/useSyncStatus.js';
import { isAuthExpired } from './queueView.js';

const RESOLVE_MESSAGES = {
  retry: 'Konflikt vrácen do fronty.',
  force: 'Zápis se odešle znovu v režimu force (u dohlášky bez zvoleného čísla).',
  drop: 'Konflikt označen jako uzavřený.',
};

/**
 * Data a akce Synchronizace (TkSynchronizace): fronta, otevřené konflikty,
 * odeslání, záloha. Obrazovka jen skládá vzhled.
 */
export function useSyncCenter() {
  const { isOnline, syncState, queueStats, refreshStats } = useSyncStatus();
  const [queueItems, setQueueItems] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedConflictId, setExpandedConflictId] = useState(null);
  const [serverSnapshotByConflict, setServerSnapshotByConflict] = useState({});

  const loadData = async () => {
    const [items, openConflicts] = await Promise.all([
      getRecentQueueItems(80),
      getOpenConflicts()
    ]);
    setQueueItems(items);
    setConflicts(openConflicts);
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Fronta stojící na vypršelém přihlášení vypadá zvenčí jako obyčejné
   * „čeká ve frontě“ – rozhodčí by čekal, až se to samo odešle, a ono by se
   * to nestalo. Stav se čte z fronty samotné, aby banner přežil obnovení.
   */
  const authExpired = useMemo(() => isAuthExpired(queueItems), [queueItems]);

  const syncNow = async () => {
    try {
      setBusy(true);
      await TimekeeperAPI.flushQueue();
      await refreshStats();
      await loadData();
      setMessage({ type: 'success', text: 'Synchronizace spuštěna.' });
    } catch {
      setMessage({ type: 'danger', text: 'Synchronizace se nezdařila.' });
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    try {
      await downloadBackup();
      setMessage({ type: 'success', text: 'Záloha byla exportována.' });
    } catch {
      setMessage({ type: 'danger', text: 'Export zálohy selhal.' });
    }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const result = await importBackupPayload(raw);
      await refreshStats();
      await loadData();

      // Import nikdy nepřepisuje, co v zařízení už je. Bez téhle věty
      // vypadá „Import dokončen (0 záznamů)“ jako selhání.
      const added = Object.values(result.tableCounts).reduce((acc, n) => acc + n, 0);
      const skipped = result.skippedTotal || 0;
      setMessage({
        type: 'success',
        text: skipped > 0
          ? `Import dokončen: přidáno ${added} záznamů, ${skipped} už bylo v zařízení (ponecháno beze změny).`
          : `Import dokončen (${added} záznamů).`
      });
    } catch (error) {
      setMessage({ type: 'danger', text: error?.message || 'Import zálohy selhal.' });
    } finally {
      event.target.value = '';
    }
  };

  const resolve = async (conflictId, action) => {
    await resolveConflict(conflictId, action);

    // Retry/Force spustí odeslání hned, ať se opakovaný konflikt ukáže hned.
    if (action === 'retry' || action === 'force') {
      try {
        await TimekeeperAPI.flushQueue();
      } catch {
        // Stav fronty a konfliktů se načte níže.
      }
    }

    await refreshStats();
    await loadData();
    setMessage({ type: 'info', text: RESOLVE_MESSAGES[action] });
  };

  /** Ruční záchrana zápisu, kterému došly pokusy – jinak zůstane ležet navždy. */
  const retryItem = async (queueItemId) => {
    try {
      setBusy(true);
      await retryQueueItem(queueItemId);
      await TimekeeperAPI.flushQueue();
      await refreshStats();
      await loadData();
      setMessage({ type: 'info', text: 'Položka byla vrácena do fronty.' });
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se položku odeslat znovu.' });
    } finally {
      setBusy(false);
    }
  };

  const loadServerSnapshot = async (conflict) => {
    const entryId = conflict?.conflict_detail?.entry_id;
    if (!entryId || serverSnapshotByConflict[conflict.id]) return;
    try {
      const data = await TimekeeperAPI.get(`/api/timekeeper/start-list/${entryId}`);
      setServerSnapshotByConflict((prev) => ({ ...prev, [conflict.id]: data }));
    } catch {
      setServerSnapshotByConflict((prev) => ({ ...prev, [conflict.id]: { _error: true } }));
    }
  };

  const toggleConflictDetails = async (conflict) => {
    if (expandedConflictId === conflict.id) {
      setExpandedConflictId(null);
      return;
    }
    setExpandedConflictId(conflict.id);
    await loadServerSnapshot(conflict);
  };

  return {
    isOnline,
    syncState,
    queueStats,
    queueItems,
    conflicts,
    message,
    clearMessage: () => setMessage(null),
    busy,
    authExpired,
    expandedConflictId,
    serverSnapshotByConflict,
    loadData,
    syncNow,
    exportBackup,
    importBackup,
    resolve,
    retryItem,
    toggleConflictDetails,
  };
}
