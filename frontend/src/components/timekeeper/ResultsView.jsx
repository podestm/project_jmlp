import React, { useState, useEffect } from 'react';
import { TimekeeperAPI } from '../../config/api.js';

export default function ResultsView() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(
    localStorage.getItem('timekeeper_selected_race') || ''
  );
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState(null);
  const [groupByCategory, setGroupByCategory] = useState(true);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadResults();
      localStorage.setItem('timekeeper_selected_race', selectedRaceId);
    }
  }, [selectedRaceId, groupByCategory]);

  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) { console.error('Failed to load races:', err); }
  };

  const loadResults = async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(
        `/api/timekeeper/races/${selectedRaceId}/results`,
        { group_by_category: groupByCategory }
      );
      setResults(data);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst výsledky' });
    } finally { setLoading(false); }
  };

  const calculatePoints = async () => {
    if (!selectedRaceId) return;
    try {
      setCalculating(true);
      const result = await TimekeeperAPI.post(`/api/timekeeper/races/${selectedRaceId}/results/calculate-points`);
      setMessage({ type: 'success', text: result.message });
      loadResults();
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se vypočítat body' });
    } finally { setCalculating(false); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (time) => time != null ? time.toFixed(2) : '—';

  const renderPositionBadge = (pos) => {
    if (!pos) return <span className="text-muted">—</span>;
    if (pos === 1) return <span className="badge" style={{ background: '#FFD700', color: '#000', fontSize: '0.75rem' }}>1.</span>;
    if (pos === 2) return <span className="badge" style={{ background: '#C0C0C0', color: '#000', fontSize: '0.75rem' }}>2.</span>;
    if (pos === 3) return <span className="badge" style={{ background: '#CD7F32', color: '#000', fontSize: '0.75rem' }}>3.</span>;
    return <span className="fw-bold">{pos}.</span>;
  };

  const renderEntryTable = (entries, showCategory = false) => (
    <div className="table-responsive">
      <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
        <thead className="table-light">
          <tr>
            <th style={{ width: '45px', padding: '4px 8px' }}>Poř.</th>
            <th style={{ width: '40px', padding: '4px 8px' }}>St.č.</th>
            <th style={{ width: '95px', padding: '4px 8px' }}>Čísla</th>
            <th style={{ padding: '4px 8px' }}>Závodník</th>
            {showCategory && <th style={{ padding: '4px 8px' }}>Kategorie</th>}
            <th style={{ padding: '4px 8px' }}>Klub</th>
            <th style={{ width: '75px', padding: '4px 8px' }} className="text-end">Jízda 1</th>
            <th style={{ width: '75px', padding: '4px 8px' }} className="text-end">Jízda 2</th>
            <th style={{ width: '85px', padding: '4px 8px' }} className="text-end fw-bold">Celk. čas</th>
            <th style={{ width: '55px', padding: '4px 8px' }} className="text-center">Body</th>
            <th style={{ width: '50px', padding: '4px 8px' }}>Stav</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={entry.status ? 'table-light text-muted' : ''}>
              <td className="text-center" style={{ padding: '3px 8px' }}>{renderPositionBadge(entry.position)}</td>
              <td className="text-center" style={{ padding: '3px 8px' }}>{entry.start_number || '—'}</td>
              <td style={{ padding: '3px 8px' }}>
                {entry.race_number_display ? (
                  <>
                    <span className="badge bg-dark" style={{ fontSize: '0.7rem' }}>{entry.race_number_display}</span>
                    <small className="text-muted d-block mt-1">Dres {entry.race_number_actual || '—'}</small>
                  </>
                ) : '—'}
              </td>
              <td style={{ padding: '3px 8px' }}>
                <span className="fw-semibold">{entry.racer_surname} {entry.racer_name}</span>
                <small className="text-muted ms-1">({entry.racer_year})</small>
              </td>
              {showCategory && (
                <td style={{ padding: '3px 8px' }}><span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>{entry.category_name || '—'}</span></td>
              )}
              <td className="text-muted" style={{ padding: '3px 8px' }}>{entry.club_name || '—'}</td>
              <td className="text-end" style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{entry.status ? '—' : formatTime(entry.time1)}</td>
              <td className="text-end" style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{entry.status ? '—' : formatTime(entry.time2)}</td>
              <td className="text-end fw-bold" style={{ padding: '3px 8px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {entry.status ? <span className="text-muted">{entry.status}</span> : formatTime(entry.time_sum)}
              </td>
              <td className="text-center" style={{ padding: '3px 8px' }}>
                {entry.points != null && entry.points > 0 ? (
                  <span className="badge" style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', fontSize: '0.7rem' }}>{entry.points}</span>
                ) : <span className="text-muted">0</span>}
              </td>
              <td className="text-center" style={{ padding: '3px 8px' }}>
                {entry.status === 'DNF' && <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>DNF</span>}
                {entry.status === 'DNS' && <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>DNS</span>}
                {entry.status === 'DSQ' && <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>DSQ</span>}
                {!entry.status && entry.time_sum != null && <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '0.8rem' }}></i>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-trophy me-2" style={{ color: '#e94560' }}></i>
            Výsledky závodu
          </h5>
          <small className="text-muted">Výsledky seřazené podle času, výpočet bodů</small>
        </div>
        {results && results.total_entries > 0 && (
          <button
            className="btn btn-sm text-white"
            style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
            onClick={calculatePoints}
            disabled={calculating}
          >
            {calculating ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Počítám...</>
            ) : (
              <><i className="bi bi-calculator me-1"></i>Vypočítat body</>
            )}
          </button>
        )}
      </div>

      {/* Race selector + options */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="row align-items-center g-2">
            <div className="col-md-5">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
                <select className="form-select form-select-sm" value={selectedRaceId}
                  onChange={(e) => setSelectedRaceId(e.target.value)} style={{ borderRadius: '8px' }}>
                  <option value="">-- Vyberte závod --</option>
                  {races.map(race => (
                    <option key={race.id} value={race.id}>
                      {race.raceNr || `#${race.id}`} — {race.areal_name || '?'} ({formatDate(race.datum)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-md-4">
              <div className="btn-group btn-group-sm w-100">
                <button className={`btn ${groupByCategory ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setGroupByCategory(true)}>
                  <i className="bi bi-collection me-1"></i>Dle kategorií
                </button>
                <button className={`btn ${!groupByCategory ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setGroupByCategory(false)}>
                  <i className="bi bi-list me-1"></i>Celkově
                </button>
              </div>
            </div>
            {results && (
              <div className="col-md-3 text-end">
                <small className="text-muted">Závodníků: </small>
                <span className="fw-bold" style={{ color: '#e94560' }}>{results.total_entries}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close ms-auto" style={{ fontSize: '0.7rem' }} onClick={() => setMessage(null)}></button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
        </div>
      )}

      {/* Results grouped by category */}
      {!loading && results && results.grouped && results.categories && (
        <div>
          {results.categories.map((cat) => (
            <div key={cat.category_id} className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
              <div className="card-header bg-white py-2 px-3" style={{ borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e94560' }}>
                <small className="fw-bold">
                  <i className="bi bi-tag-fill me-1" style={{ color: '#e94560' }}></i>
                  {cat.category_name}
                  <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>{cat.entries.length}</span>
                </small>
              </div>
              <div className="card-body p-0">
                {renderEntryTable(cat.entries, false)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results flat */}
      {!loading && results && !results.grouped && results.entries && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
          <div className="card-header bg-white py-2 px-3" style={{ borderRadius: '10px 10px 0 0', borderBottom: '2px solid #e94560' }}>
            <small className="fw-bold">
              <i className="bi bi-trophy-fill me-1" style={{ color: '#e94560' }}></i>
              Celkové pořadí
            </small>
          </div>
          <div className="card-body p-0">
            {renderEntryTable(results.entries, true)}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!loading && results && results.total_entries === 0 && (
        <div className="text-center py-4">
          <i className="bi bi-trophy text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 mb-0 small">Žádné výsledky</p>
          <small className="text-muted">Nejprve zadejte časy závodníkům</small>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-4">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Vyberte závod pro zobrazení výsledků</p>
        </div>
      )}
    </div>
  );
}
