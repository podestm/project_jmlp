import React, { useEffect, useMemo, useState } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { downloadBackup, importBackupPayload } from '../../offline/backup.js';
import { getOpenConflicts, getRecentQueueItems, resolveConflict, retryQueueItem } from '../../offline/syncQueue.js';
import { useSyncStatus } from '../../offline/useSyncStatus.js';
import { formatDateTimeShort } from '../../utils/date.js';
import { TimekeeperMessage, TK_ACCENT } from './TimekeeperChrome.jsx';

const STATUS_BADGE = {
  done: 'bg-success',
  failed: 'bg-warning text-dark',
  conflict: 'bg-danger',
  dead: 'bg-danger'
};

// Text, kterým přehrávací smyčka označí zápis zaparkovaný na vypršelém tokenu
// (viz AUTH_EXPIRED_MESSAGE v offline/sync.js). Poznáváme ho podle začátku,
// aby banner nezmizel při drobné úpravě konce věty.
const AUTH_EXPIRED_PREFIX = 'Přihlášení vypršelo';

export default function SyncCenter() {
  const { syncState, queueStats, refreshStats } = useSyncStatus();
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
   * "čeká ve frontě" - rozhodčí by čekal, až se to samo odešle, a ono by se
   * to nestalo. Stav se čte z fronty samotné, ne z paměti, aby banner přežil
   * i obnovení stránky.
   */
  const authExpired = useMemo(() => queueItems.some((item) => (
    item.status === 'pending'
    && typeof item.last_error === 'string'
    && item.last_error.startsWith(AUTH_EXPIRED_PREFIX)
  )), [queueItems]);

  const handleSyncNow = async () => {
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

  const handleExport = async () => {
    try {
      await downloadBackup();
      setMessage({ type: 'success', text: 'Záloha byla exportována.' });
    } catch {
      setMessage({ type: 'danger', text: 'Export zálohy selhal.' });
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const result = await importBackupPayload(raw);
      await refreshStats();
      await loadData();

      // Import zálohy nikdy nepřepisuje, co v zařízení už je. Bez téhle věty
      // vypadá "Import dokončen (0 záznamů)" jako selhání, i když je všechno
      // v pořádku.
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

  const conflictBadgeClass = useMemo(() => {
    if (conflicts.length > 0) return 'bg-danger';
    if (syncState === 'offline') return 'bg-warning text-dark';
    if (syncState === 'syncing') return 'bg-info text-dark';
    return 'bg-success';
  }, [conflicts.length, syncState]);

  const handleResolve = async (conflictId, action) => {
    await resolveConflict(conflictId, action);

    // Retry/Force should immediately re-run sync so a repeated conflict appears right away.
    if (action === 'retry' || action === 'force') {
      try {
        await TimekeeperAPI.flushQueue();
      } catch {
        // Ignore here; queue/conflict state is refreshed below.
      }
    }

    await refreshStats();
    await loadData();
    setMessage({
      type: 'info',
      text: action === 'retry'
        ? 'Konflikt vrácen do fronty.'
        : action === 'force'
          ? 'Konflikt bude odeslán v režimu force apply.'
          : 'Konflikt označen jako uzavřený.'
    });
  };

  /** Ruční záchrana zápisu, kterému došly pokusy - jinak zůstane ležet navždy. */
  const handleRetryItem = async (queueItemId) => {
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

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Ano' : 'Ne';
    return String(value);
  };

  const getLocalConflictEntry = (conflict) => {
    const payload = conflict?.payload || {};
    const detail = conflict?.conflict_detail || {};
    const targetEntryId = detail.entry_id;

    if (Array.isArray(payload.entries)) {
      const match = payload.entries.find((entry) => Number(entry?.entry_id) === Number(targetEntryId));
      return match || null;
    }

    return payload;
  };

  const loadServerSnapshot = async (conflict) => {
    const detail = conflict?.conflict_detail || {};
    const entryId = detail.entry_id;
    if (!entryId) return;
    if (serverSnapshotByConflict[conflict.id]) return;

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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
        <div>
          <h5 className="fw-bold mb-1">
            <i className="bi bi-arrow-repeat me-2" style={{ color: TK_ACCENT }}></i>
            Sync centrum
          </h5>
          <small className="text-muted">Správa fronty, konfliktů a lokálních záloh.</small>
        </div>
        <span className={`badge ${conflictBadgeClass}`}>
          Konflikty: {conflicts.length}
        </span>
      </div>

      {authExpired && (
        <div className="alert alert-warning py-2 d-flex align-items-center small" role="alert">
          <i className="bi bi-person-lock me-2"></i>
          Přihlášení vypršelo – fronta čeká, přihlaste se znovu.
        </div>
      )}

      <TimekeeperMessage message={message} onDismiss={() => setMessage(null)} />

      <div className="row row-cols-2 row-cols-md-5 g-3 mb-3">
        <div className="col">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Ve frontě</small>
              <div className="fs-4 fw-bold">{queueStats.pending}</div>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Chyby</small>
              <div className="fs-4 fw-bold text-warning">{queueStats.failed}</div>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Konflikty</small>
              <div className="fs-4 fw-bold text-danger">{queueStats.conflict || 0}</div>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Aktivně sync</small>
              <div className="fs-4 fw-bold text-primary">{queueStats.processing}</div>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <small className="text-muted">Neodeslané</small>
              <div className="fs-4 fw-bold text-danger">{queueStats.dead || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <button className="btn btn-sm btn-danger" disabled={busy} onClick={handleSyncNow}>
            <i className="bi bi-cloud-upload me-1"></i>
            Sync now
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleExport}>
            <i className="bi bi-download me-1"></i>
            Export zálohy
          </button>
          <label className="btn btn-sm btn-outline-secondary mb-0">
            <i className="bi bi-upload me-1"></i>
            Import zálohy
            <input type="file" accept="application/json" className="d-none" onChange={handleImport} />
          </label>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadData}>
            Obnovit přehled
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-white fw-semibold">Otevřené konflikty</div>
        <div className="card-body p-0">
          {conflicts.length === 0 ? (
            <div className="p-3 text-muted small">Žádné otevřené konflikty.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Čas</th>
                    <th>Operace</th>
                    <th>Endpoint</th>
                    <th>Chyba</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((conflict) => (
                    <React.Fragment key={conflict.id}>
                      <tr>
                        <td>{formatDateTimeShort(conflict.created_at)}</td>
                        <td>{conflict.method}</td>
                        <td className="small">{conflict.endpoint}</td>
                        <td className="small text-danger">
                          <div>{conflict.error_message}</div>
                          {conflict?.conflict_detail?.code === 'stale_revision' && (
                            <div className="text-muted mt-1">
                              entry #{conflict.conflict_detail.entry_id} | client: {conflict.conflict_detail.client_revision || 'n/a'} | server: {conflict.conflict_detail.server_revision || 'n/a'}
                            </div>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1">
                            <button className="btn btn-outline-dark btn-sm" onClick={() => toggleConflictDetails(conflict)}>
                              {expandedConflictId === conflict.id ? 'Skrýt' : 'Detail'}
                            </button>
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-primary" onClick={() => handleResolve(conflict.id, 'retry')}>
                                Retry
                              </button>
                              <button className="btn btn-outline-danger" onClick={() => handleResolve(conflict.id, 'force')}>
                                Force
                              </button>
                              <button className="btn btn-outline-secondary" onClick={() => handleResolve(conflict.id, 'drop')}>
                                Drop
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {expandedConflictId === conflict.id && (
                        <tr>
                          <td colSpan={5} className="bg-light">
                            <div className="small fw-semibold mb-2">Co se přepíše při Force</div>
                            <div className="table-responsive">
                              <table className="table table-sm mb-0">
                                <thead>
                                  <tr>
                                    <th>Pole</th>
                                    <th>Lokální fronta</th>
                                    <th>Server teď</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const localEntry = getLocalConflictEntry(conflict) || {};
                                    const serverEntry = serverSnapshotByConflict[conflict.id] || {};
                                    const fields = ['time1', 'time2', 'dnf', 'dns', 'dsq'];
                                    return fields.map((field) => (
                                      <tr key={field}>
                                        <td>{field}</td>
                                        <td>{formatValue(localEntry[field])}</td>
                                        <td>{serverEntry._error ? 'Nelze načíst' : formatValue(serverEntry[field])}</td>
                                      </tr>
                                    ));
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white fw-semibold">Poslední položky fronty</div>
        <div className="card-body p-0">
          {queueItems.length === 0 ? (
            <div className="p-3 text-muted small">Fronta je prázdná.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Čas</th>
                    <th>Metoda</th>
                    <th>Endpoint</th>
                    <th>Stav</th>
                    <th>Retry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item) => (
                    // 'dead' znamená naměřený čas, který na serveru není. Řádek
                    // musí být vidět na první pohled, ne jen jako slovo ve sloupci.
                    <tr key={item.id} className={item.status === 'dead' ? 'table-danger' : ''}>
                      <td>{formatDateTimeShort(item.created_at)}</td>
                      <td>{item.method}</td>
                      <td className="small">{item.endpoint}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[item.status] || 'bg-secondary'}`}>
                          {item.status === 'dead' ? 'neodesláno' : item.status}
                        </span>
                        {item.last_error && (
                          <div className="text-muted small">{item.last_error}</div>
                        )}
                      </td>
                      <td>{item.retry_count || 0}</td>
                      <td className="text-end">
                        {(item.status === 'dead' || item.status === 'failed') && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={busy}
                            onClick={() => handleRetryItem(item.id)}
                          >
                            Zkusit znovu
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
