import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import {
  KIND,
  PAIR_STATUS,
  STATUS_TABS,
  appliedLabels,
  bulkConfirmable,
  changeLabels,
  filterPairs,
  pairWarnings
} from './slcrPairing.js';

const POLL_MS = 3000;

const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

/**
 * Párování závodníků s evidencí Svazu lyžařů ČR.
 *
 * Návrhy načítá server z veřejných údajů evidence (výsledky akcí JMLP
 * a hledání členů). Nic se nepřepisuje samo - správce návrh potvrdí nebo
 * odmítne; "ID závodníka" v registru zůstává, jak ho závodník zadal,
 * tabulka jen ukáže, kde nesouhlasí s evidencí.
 */
export default function SlcrPairing() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(PAIR_STATUS.suggested);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
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

  const decide = async (item, action) => {
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
  };

  const visible = useMemo(() => filterPairs(items, { query, kind }), [items, query, kind]);
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
      : { type: 'success', text: `Potvrzeno ${confirmable.length} jasných shod.` });
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

  const counts = summary?.counts || {};
  const job = summary?.job;

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <small><Link to="/admin/racers" className="text-decoration-none"><i className="bi bi-chevron-left" /> Závodníci</Link></small>
        <h2 className="mb-0">Párování se SLČR</h2>
        <small className="text-muted">
          Křížová kontrola registru s evidencí Svazu lyžařů ČR: komu v evidenci patří naše ID závodníka
          a kdo v evidenci má naše jméno a ročník (ročník podle výsledků, jinak dopočtený z věku). Jména se
          porovnávají přesně, klub se neposuzuje. Potvrzení opraví náš záznam podle evidence, „Vrátit“ to
          vezme zpět.
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
              aria-label="Koho načíst"
            >
              <option value="active">Aktivní závodníci (letos a loni)</option>
              <option value="all">Celý registr</option>
            </select>
            <button className="btn btn-sm btn-primary" onClick={startSync} disabled={running || !summary}>
              {running ? <ButtonSpinner /> : <i className="bi bi-cloud-download me-1" />}
              Načíst návrhy ze SLČR
            </button>
          </div>
          {running && job ? (
            <div className="flex-grow-1" style={{ minWidth: '200px' }}>
              <div className="small text-muted mb-1">
                Načítám z evidence SLČR… {job.done} z {job.total || '?'} závodníků
              </div>
              <div className="progress" style={{ height: '6px' }}>
                <div className="progress-bar" style={{ width: `${job.total ? (job.done / job.total) * 100 : 5}%` }} />
              </div>
            </div>
          ) : (
            <small className="text-muted">
              {job
                ? <>Naposledy načteno {formatDateTime(job.finished_at || job.started_at)}{job.error && <span className="text-danger"> – chyba: {job.error}</span>}</>
                : 'Zatím nenačteno. Načtení trvá několik minut.'}
            </small>
          )}
        </div>
      </div>

      {counts.pending_apply > 0 && (
        <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>
            U {counts.pending_apply} potvrzených závodníků se ještě nepřevzaly údaje z evidence
            (potvrzeno dřív, než potvrzení začalo opravovat záznam).
          </span>
          <button className="btn btn-sm btn-primary" onClick={applyConfirmed} disabled={bulk != null}>
            {bulk ? <ButtonSpinner /> : <i className="bi bi-pencil-square me-1" />}
            Převzít z evidence
          </button>
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        {STATUS_TABS.map((tab) => (
          <li className="nav-item" key={tab.status}>
            <button
              className={`nav-link ${status === tab.status ? 'active' : ''}`}
              onClick={() => setStatus(tab.status)}
            >
              {tab.label} <span className="badge bg-secondary ms-1">{counts[tab.status] ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="row g-2 mb-3 align-items-center">
        <div className="col-md-5">
          <input
            type="search"
            className="form-control"
            placeholder="Hledat jméno nebo ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {status === PAIR_STATUS.suggested && (
          <>
            <div className="col-md-3">
              <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Výsledek kontroly">
                <option value="all">Všechny výsledky kontroly</option>
                {Object.entries(KIND).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4 text-md-end">
              <button
                className="btn btn-outline-success"
                onClick={confirmAllSure}
                disabled={confirmable.length === 0 || bulk != null}
                title="Jen „Sedí“ a „Doplnit ID“ bez upozornění a bez změny ročníku"
              >
                {bulk ? <><ButtonSpinner />Potvrzuji {bulk.done} z {bulk.total}</> : <><i className="bi bi-check2-all me-1" />Potvrdit jasné ({confirmable.length})</>}
              </button>
            </div>
          </>
        )}
      </div>

      {loading && items.length === 0 ? (
        <LoadingState variant="page" label="Načítám párování…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="bi-person-check"
          title={items.length === 0 ? 'Tady zatím nikdo není' : 'Nikdo neodpovídá hledání'}
          hint={items.length === 0 && !job ? 'Začněte tlačítkem „Načíst návrhy ze SLČR“.' : undefined}
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Závodník u nás</th>
                <th>Evidence SLČR</th>
                <th>Shoda</th>
                <th className="text-end">Akce</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <PairRow key={item.racer_id} item={item} busy={busy[item.racer_id]} onDecide={decide} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PairRow({ item, busy, onDecide }) {
  const { racer, slcr } = item;
  const kindInfo = KIND[item.kind];
  const warnings = pairWarnings(item);
  const button = (action, label, className, icon) => (
    <button
      className={`btn btn-sm ${className} ms-1`}
      onClick={() => onDecide(item, action)}
      disabled={Boolean(busy)}
    >
      {busy === action ? <ButtonSpinner /> : <i className={`bi ${icon} me-1`} />}
      {label}
    </button>
  );

  return (
    <tr>
      <td>
        <div className="fw-semibold">{racer.surname} {racer.name}</div>
        <small className="text-muted">
          {racer.year} · {racer.club || 'bez klubu'} · ID {racer.slcr_id || '—'}
        </small>
      </td>
      <td>
        {slcr ? (
          <>
            <a href={slcr.url} target="_blank" rel="noopener noreferrer" className="fw-semibold">
              {slcr.surname} {slcr.name} <i className="bi bi-box-arrow-up-right small" />
            </a>
            <div>
              <small className="text-muted">
                {slcr.year || 'ročník neuveden'} · číslo {slcr.race_code || '—'}
              </small>
            </div>
            {item.alternatives?.length > 0 && (
              <small className="text-muted d-block">
                Další kandidáti:{' '}
                {item.alternatives.map((alt, index) => (
                  <React.Fragment key={alt.member_id || index}>
                    {index > 0 && ', '}
                    <a href={alt.url} target="_blank" rel="noopener noreferrer">{alt.surname} {alt.name}{alt.race_code ? ` (${alt.race_code})` : ''}</a>
                  </React.Fragment>
                ))}
              </small>
            )}
          </>
        ) : (
          <span className="text-muted">Nenalezen</span>
        )}
      </td>
      <td style={{ maxWidth: '320px' }}>
        {kindInfo && <span className={`badge ${kindInfo.className} me-1`}>{kindInfo.label}</span>}
        {item.note && <small className="text-muted">{item.note}</small>}
        {changeLabels(item).length > 0 && (
          <div className="small mt-1">
            <i className="bi bi-pencil-square me-1 text-primary" />
            {item.status === PAIR_STATUS.confirmed ? 'K převzetí z evidence: ' : 'Potvrzení u nás změní: '}
            <span className="fw-semibold">{changeLabels(item).join(', ')}</span>
          </div>
        )}
        {appliedLabels(item).length > 0 && (
          <div className="small text-muted mt-1">
            <i className="bi bi-check2 me-1" />Převzato z evidence ({appliedLabels(item).join(', ')})
          </div>
        )}
        {warnings.map((warning) => (
          <div key={warning.key}>
            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle mt-1 text-wrap text-start">
              <i className="bi bi-exclamation-triangle me-1" />{warning.text}
            </span>
          </div>
        ))}
      </td>
      <td className="text-end text-nowrap">
        {item.status === PAIR_STATUS.suggested && (
          <>
            {button('confirm', 'Potvrdit', 'btn-success', 'bi-check-lg')}
            {button('reject', 'Odmítnout', 'btn-outline-danger', 'bi-x-lg')}
          </>
        )}
        {(item.status === PAIR_STATUS.confirmed || item.status === PAIR_STATUS.rejected) && (
          button('undo', 'Vrátit', 'btn-outline-secondary', 'bi-arrow-counterclockwise')
        )}
      </td>
    </tr>
  );
}
