import { useCallback, useEffect, useState } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { ButtonSpinner } from '../ui/LoadingState.jsx';
import { TK_ACCENT } from './TimekeeperChrome.jsx';

/**
 * Evidence SLČR u závodu: výběr akce, založení závodů po kategoriích
 * a odeslání výsledků (backend routers/timekeeper/slcr.py).
 *
 * Akce i disciplína se pamatují v prohlížeči pro každý závod zvlášť, aby se
 * výsledky po závodě posílaly do stejné akce, kde se ráno zakládaly závody.
 */
const ACTION_LABELS = {
  create: { text: 'Založí se', className: 'text-bg-primary' },
  codex: { text: 'Doplní se kodex', className: 'text-bg-warning' },
  keep: { text: 'Už je', className: 'text-bg-success' },
};

// Text chyby od backendu (detail), ne obecné "API Error: 502".
const errorText = (err) => (typeof err?.detail === 'string' && err.detail) || err?.message || 'Neznámá chyba';

const storageKey = (raceId) => `slcr_event_${raceId}`;

const readStored = (raceId) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(raceId)) || '{}') || {};
  } catch {
    return {};
  }
};

const writeStored = (raceId, value) => {
  try {
    localStorage.setItem(storageKey(raceId), JSON.stringify(value));
  } catch {
    // Bez úložiště se jen nic nepamatuje.
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return day ? `${Number(day)}. ${Number(month)}. ${year}` : value;
};

export default function SlcrModal({ race, hasResults, onClose }) {
  const raceId = race?.id;
  const stored = readStored(raceId);
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);
  const [eventId, setEventId] = useState(stored.eventId ? String(stored.eventId) : '');
  const [discipline, setDiscipline] = useState(stored.discipline || 26);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  useEffect(() => {
    let cancelled = false;
    TimekeeperAPI.getOnline('/api/timekeeper/slcr/status')
      .then((data) => { if (!cancelled) setStatus(data); })
      .catch((err) => { if (!cancelled) setMessage({ type: 'danger', text: errorText(err) }); });
    TimekeeperAPI.getOnline(`/api/timekeeper/races/${raceId}/slcr/events`)
      .then((data) => { if (!cancelled) setEvents(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setEventsError(errorText(err)); });
    return () => { cancelled = true; };
  }, [raceId]);

  const remember = useCallback((next) => {
    writeStored(raceId, { eventId: Number(next.eventId) || null, discipline: Number(next.discipline) });
  }, [raceId]);

  const loadPlan = async () => {
    if (!eventId) return;
    setBusy('plan');
    setMessage(null);
    try {
      const data = await TimekeeperAPI.getOnline(`/api/timekeeper/races/${raceId}/slcr/plan`, {
        event_id: eventId, discipline,
      });
      setPlan(data);
      remember({ eventId, discipline });
    } catch (err) {
      setPlan(null);
      setMessage({ type: 'danger', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const createRaces = async () => {
    setBusy('races');
    setMessage(null);
    try {
      const data = await TimekeeperAPI.postOnline(`/api/timekeeper/races/${raceId}/slcr/races`, {
        event_id: Number(eventId), discipline: Number(discipline),
      });
      setPlan({ event: data.event, items: data.items });
      const parts = [];
      if (data.created) parts.push(`založeno ${data.created} závodů`);
      if (data.codex_filled) parts.push(`doplněn kodex u ${data.codex_filled}`);
      setMessage({ type: 'success', text: parts.length ? `Hotovo: ${parts.join(', ')}.` : 'Všechny závody už v akci jsou.' });
    } catch (err) {
      setMessage({ type: 'danger', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const sendResults = async () => {
    setBusy('results');
    setMessage(null);
    try {
      const data = await TimekeeperAPI.postOnline(`/api/timekeeper/races/${raceId}/slcr/results`, {
        event_id: Number(eventId), discipline: Number(discipline),
      });
      remember({ eventId, discipline });
      const note = data.unfinished ? ` ${data.unfinished} startujících bez času a bez příznaku se neposlalo.` : '';
      setMessage({
        type: 'success',
        text: `Výsledky jsou v evidenci (zatím nezveřejněné - zveřejňuje se v evidenci).${note}`,
      });
    } catch (err) {
      setMessage({ type: 'danger', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const changes = plan?.items?.filter((item) => item.action !== 'keep').length || 0;
  const missingKeep = plan?.items?.some((item) => item.action !== 'keep');
  const notConfigured = status && (!status.token || !status.login);

  return (
    <>
      <div className="modal-backdrop fade show" onClick={() => !busy && onClose()} />
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h6 className="modal-title">
                <i className="bi bi-cloud-upload me-2" style={{ color: TK_ACCENT }}></i>
                Evidence SLČR - {race?.race_nr} ({formatDate(race?.datum)})
              </h6>
              <button type="button" className="btn-close" onClick={onClose} disabled={Boolean(busy)} aria-label="Zavřít" />
            </div>
            <div className="modal-body">
              {notConfigured && (
                <div className="alert alert-warning py-2 small">
                  SLČR není nastavené na serveru:
                  {!status.token && ' chybí token časomíry (SLCR_API_TOKEN)'}
                  {!status.token && !status.login && ','}
                  {!status.login && ' chybí přihlášení do evidence (SLCR_USERNAME, SLCR_PASSWORD)'}.
                </div>
              )}

              <div className="row g-2 align-items-end mb-3">
                <div className="col-12 col-md-7">
                  <label className="form-label small mb-1">Akce v evidenci</label>
                  {events && events.length > 0 ? (
                    <select
                      className="form-select form-select-sm"
                      value={events.some((ev) => String(ev.id) === eventId) ? eventId : ''}
                      onChange={(e) => { setEventId(e.target.value); setPlan(null); }}
                    >
                      <option value="">Vyber akci…</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {formatDate(ev.date)} - {ev.name}{ev.place ? `, ${ev.place}` : ''} (#{ev.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="small text-muted">
                      {events === null && !eventsError ? 'Načítám akce…' : null}
                      {eventsError ? `Akce se nepodařilo načíst: ${eventsError}` : null}
                      {events && events.length === 0 ? 'Kolem data závodu v evidenci žádná akce není.' : null}
                    </div>
                  )}
                  <input
                    className="form-control form-control-sm mt-1"
                    inputMode="numeric"
                    placeholder="nebo číslo akce (z adresy v evidenci)"
                    value={eventId}
                    onChange={(e) => { setEventId(e.target.value.replace(/\D/g, '')); setPlan(null); }}
                  />
                </div>
                <div className="col-7 col-md-3">
                  <label className="form-label small mb-1">Disciplína</label>
                  <select
                    className="form-select form-select-sm"
                    value={discipline}
                    onChange={(e) => { setDiscipline(Number(e.target.value)); setPlan(null); }}
                  >
                    {(status?.disciplines || [{ id: 26, name: 'Trénink' }]).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-5 col-md-2 d-grid">
                  <button className="btn btn-sm btn-outline-secondary" onClick={loadPlan} disabled={!eventId || Boolean(busy)}>
                    {busy === 'plan' ? <ButtonSpinner /> : <i className="bi bi-search me-1"></i>}
                    Náhled
                  </button>
                </div>
              </div>

              {plan && (
                <>
                  <div className="small mb-2">
                    <strong>{plan.event?.name}</strong>
                    {plan.event?.place ? `, ${plan.event.place}` : ''} · {formatDate(plan.event?.date)}
                    {plan.event?.url && (
                      <a className="ms-2" href={plan.event.url} target="_blank" rel="noreferrer">
                        otevřít v evidenci <i className="bi bi-box-arrow-up-right"></i>
                      </a>
                    )}
                  </div>
                  {plan.event?.category_mode !== 'Manual' && (
                    <div className="alert alert-warning py-2 small">
                      Akce používá kategorie z číselníku. Než se závody založí, přepni ji v evidenci
                      v nastavení akce na vlastní kategorie.
                    </div>
                  )}
                  <div className="table-responsive">
                    <table className="table table-sm align-middle small mb-2">
                      <thead>
                        <tr><th>Kategorie</th><th className="text-center">Kodex</th><th>V evidenci</th></tr>
                      </thead>
                      <tbody>
                        {plan.items.map((item) => {
                          const label = ACTION_LABELS[item.action] || { text: item.action, className: 'text-bg-secondary' };
                          return (
                            <tr key={item.category_id}>
                              <td>{item.name}</td>
                              <td className="text-center">{item.category_id}</td>
                              <td>
                                <span className={`badge ${label.className}`}>{label.text}</span>
                                {item.slcr_name && item.slcr_name !== item.name && (
                                  <span className="text-muted ms-2">{item.slcr_name}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {message && <div className={`alert alert-${message.type} py-2 small mb-0`}>{message.text}</div>}
            </div>
            <div className="modal-footer py-2">
              <button
                className="btn btn-sm btn-primary"
                onClick={createRaces}
                disabled={!plan || !changes || plan.event?.category_mode !== 'Manual' || Boolean(busy) || notConfigured}
                title="Založí v akci chybějící závody (název, pohlaví, ročníky, kodex = id kategorie)"
              >
                {busy === 'races' ? <ButtonSpinner /> : <i className="bi bi-plus-circle me-1"></i>}
                Založit závody{changes ? ` (${changes})` : ''}
              </button>
              <button
                className="btn btn-sm btn-success"
                onClick={sendResults}
                disabled={!eventId || !hasResults || Boolean(busy) || notConfigured || missingKeep}
                title={missingKeep
                  ? 'Nejdřív založ v akci všechny závody - výsledky se k nim přiřazují podle kodexu'
                  : 'Pošle výsledky všech kategorií do akce (nezveřejní je)'}
              >
                {busy === 'results' ? <ButtonSpinner /> : <i className="bi bi-send me-1"></i>}
                Odeslat výsledky
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
