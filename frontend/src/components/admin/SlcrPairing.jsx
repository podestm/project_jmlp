import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import { changeLabels, filterFilled } from './slcrPairing.js';

const POLL_MS = 3000;

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * Doplnění chybějících ID závodníků z evidence Svazu lyžařů ČR.
 *
 * Spouští se ručně, pak běží samo na serveru: závodníkovi bez ID najde člena
 * evidence se stejným jménem (bez ohledu na diakritiku) a ročníkem (podle
 * věku) a doplní mu ID. Nic jiného nemění. Každé doplnění jde vrátit.
 */
export default function SlcrPairing() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [manual, setManual] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState(null);

  const loadSummary = useCallback(async () => {
    const data = await AdminAPI.get('/api/admin/slcr/summary');
    setSummary(data);
    return data;
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [filled, toResolve] = await Promise.all([
        AdminAPI.get('/api/admin/slcr/filled'),
        AdminAPI.get('/api/admin/slcr/manual')
      ]);
      setItems(filled);
      setManual(toResolve);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary().catch((err) => setMessage({ type: 'danger', text: err.message }));
    loadItems();
  }, [loadSummary, loadItems]);

  // Během běhu sledujeme průběh; po doběhnutí obnovíme seznam.
  const running = Boolean(summary?.running);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(async () => {
      try {
        const data = await loadSummary();
        if (!data.running) {
          loadItems();
          setMessage(data.job?.error
            ? { type: 'danger', text: `Doplňování ID selhalo: ${data.job.error}` }
            : { type: 'success', text: `Hotovo - doplněno ${data.counts.filled_last_run} ID.` });
        }
      } catch {
        // Další pokus za chvíli.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, loadSummary, loadItems]);

  const start = async () => {
    try {
      await AdminAPI.post('/api/admin/slcr/sync', { scope });
      setMessage(null);
      await loadSummary();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const undo = async (item) => {
    setBusy((prev) => ({ ...prev, [item.racer_id]: true }));
    try {
      await AdminAPI.post(`/api/admin/slcr/filled/${item.racer_id}/undo`, {});
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
  };

  const resolve = async (item, action, memberId = null) => {
    setBusy((prev) => ({ ...prev, [item.racer_id]: true }));
    try {
      await AdminAPI.post(`/api/admin/slcr/manual/${item.racer_id}/${action}`, memberId ? { member_id: memberId } : {});
      setManual((prev) => prev.filter((other) => other.racer_id !== item.racer_id));
      if (action === 'assign') loadItems();
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
  };

  const visible = useMemo(() => filterFilled(items, query), [items, query]);
  const counts = summary?.counts || {};
  const job = summary?.job;

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <small><Link to="/admin/racers" className="text-decoration-none"><i className="bi bi-chevron-left" /> Závodníci</Link></small>
        <h2 className="mb-0">Doplnění ID ze SLČR</h2>
        <small className="text-muted">
          Závodníkům, kteří u nás nemají ID závodníka, se doplní ID z evidence Svazu lyžařů ČR - když tam
          je přesně jeden člen se stejným jménem (bez ohledu na diakritiku) a ročníkem (podle věku). Nic jiného
          se nemění a každé doplnění jde vrátit.
        </small>
      </div>

      {message && (
        <Alert key={message.text} type={message.type} message={message.text} onDismiss={() => setMessage(null)} />
      )}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={running}
              aria-label="Koho projít"
            >
              <option value="all">Celý registr</option>
              <option value="active">Jen aktivní (letos a loni)</option>
            </select>
            <button className="btn btn-sm btn-primary" onClick={start} disabled={running || !summary}>
              {running ? <ButtonSpinner /> : <i className="bi bi-cloud-download me-1" />}
              Doplnit chybějící ID
            </button>
          </div>
          {running && job ? (
            <div className="flex-grow-1" style={{ minWidth: '200px' }}>
              <div className="small text-muted mb-1">Hledám v evidenci SLČR… {job.done} z {job.total || '?'} závodníků bez ID</div>
              <div className="progress" style={{ height: '6px' }}>
                <div className="progress-bar" style={{ width: `${job.total ? (job.done / job.total) * 100 : 5}%` }} />
              </div>
            </div>
          ) : (
            <small className="text-muted">
              {job
                ? <>Naposledy {formatDateTime(job.finished_at || job.started_at)}, doplněno {counts.filled_last_run ?? 0} ID{job.error && <span className="text-danger"> – chyba: {job.error}</span>}.</>
                : 'Zatím nespuštěno. Běh trvá několik minut.'}
              {' '}ID nemá {counts.missing ?? '?'} závodníků v registru.
            </small>
          )}
        </div>
      </div>

      {manual.length > 0 && (
        <div className="card border-warning mb-4">
          <div className="card-header bg-warning-subtle">
            <h5 className="mb-0">K ručnímu zpracování <span className="badge bg-warning text-dark">{manual.length}</span></h5>
            <small className="text-muted">
              Evidence SLČR má víc členů se stejným jménem i ročníkem (nejspíš je tam člověk zapsaný dvakrát).
              Vyberte, které ID závodníkovi patří - podle karty člena, výsledků nebo oddílu.
            </small>
          </div>
          <div className="list-group list-group-flush">
            {manual.map((item) => (
              <div key={item.racer_id} className="list-group-item">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <span className="fw-semibold">{item.racer.surname} {item.racer.name}</span>
                    <small className="text-muted ms-2">{item.racer.year}</small>
                  </div>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => resolve(item, 'dismiss')} disabled={Boolean(busy[item.racer_id])}>
                    Nepřiřazovat
                  </button>
                </div>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {item.candidates.map((candidate) => (
                    <div key={candidate.member_id} className="border rounded px-2 py-1 d-flex align-items-center gap-2">
                      <a href={candidate.url} target="_blank" rel="noopener noreferrer">
                        ID {candidate.race_code} <i className="bi bi-box-arrow-up-right small" />
                      </a>
                      <small className="text-muted">{candidate.club || 'bez klubu'}{candidate.age != null ? ` · ${candidate.age} let` : ''}</small>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => resolve(item, 'assign', candidate.member_id)}
                        disabled={Boolean(busy[item.racer_id])}
                      >
                        Přiřadit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h5 className="mb-0">Doplněná ID <span className="badge bg-secondary">{items.length}</span></h5>
        <input
          type="search"
          className="form-control"
          style={{ maxWidth: '360px' }}
          placeholder="Hledat jméno nebo ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && items.length === 0 ? (
        <LoadingState variant="page" label="Načítám…" />
      ) : visible.length === 0 ? (
        <EmptyState icon="bi-person-check" title={items.length === 0 ? 'Zatím nic doplněno' : 'Nikdo neodpovídá hledání'} />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Závodník</th>
                <th>Člen SLČR</th>
                <th>Změna</th>
                <th>Kdy</th>
                <th className="text-end">Akce</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.racer_id}>
                  <td>
                    <div className="fw-semibold">{item.racer.surname} {item.racer.name}</div>
                    <small className="text-muted">{item.racer.year}</small>
                  </td>
                  <td>
                    {item.slcr ? (
                      <a href={item.slcr.url} target="_blank" rel="noopener noreferrer">
                        {item.slcr.surname} {item.slcr.name} <i className="bi bi-box-arrow-up-right small" />
                      </a>
                    ) : '—'}
                  </td>
                  <td><small>{changeLabels(item).join(', ') || '—'}</small></td>
                  <td><small className="text-muted">{formatDateTime(item.applied_at)}</small></td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => undo(item)} disabled={Boolean(busy[item.racer_id])}>
                      {busy[item.racer_id] ? <ButtonSpinner /> : <i className="bi bi-arrow-counterclockwise me-1" />}
                      Vrátit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
