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

  useEffect(() => {
    loadRaces();
  }, []);

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
    } catch (err) {
      console.error('Failed to load races:', err);
    }
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
    } finally {
      setLoading(false);
    }
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
    } finally {
      setCalculating(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (time) => {
    if (time == null) return '—';
    return time.toFixed(2);
  };

  const renderPositionBadge = (pos) => {
    if (!pos) return <span className="text-muted">—</span>;
    if (pos === 1) return <span className="badge" style={{ background: '#FFD700', color: '#000', fontSize: '0.9rem' }}>1.</span>;
    if (pos === 2) return <span className="badge" style={{ background: '#C0C0C0', color: '#000', fontSize: '0.9rem' }}>2.</span>;
    if (pos === 3) return <span className="badge" style={{ background: '#CD7F32', color: '#fff', fontSize: '0.9rem' }}>3.</span>;
    return <span className="fw-bold">{pos}.</span>;
  };

  const renderEntryTable = (entries, showCategory = false) => (
    <div className="table-responsive">
      <table className="table table-hover mb-0 align-middle">
        <thead className="table-light">
          <tr>
            <th style={{ width: '60px' }}>Poř.</th>
            <th style={{ width: '50px' }}>St.č.</th>
            <th>Závodník</th>
            {showCategory && <th>Kategorie</th>}
            <th>Klub</th>
            <th style={{ width: '100px' }} className="text-end">Jízda 1</th>
            <th style={{ width: '100px' }} className="text-end">Jízda 2</th>
            <th style={{ width: '110px' }} className="text-end fw-bold">Celk. čas</th>
            <th style={{ width: '70px' }} className="text-center">Body</th>
            <th style={{ width: '60px' }}>Stav</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={entry.status ? 'table-light text-muted' : ''}>
              <td className="text-center">{renderPositionBadge(entry.position)}</td>
              <td className="text-center">{entry.start_number || '—'}</td>
              <td>
                <div className="fw-semibold">{entry.racer_surname} {entry.racer_name}</div>
                <small className="text-muted">{entry.racer_year}</small>
              </td>
              {showCategory && (
                <td><span className="badge bg-secondary">{entry.category_name || '—'}</span></td>
              )}
              <td className="text-muted small">{entry.club_name || '—'}</td>
              <td className="text-end" style={{ fontFamily: 'monospace' }}>{formatTime(entry.time1)}</td>
              <td className="text-end" style={{ fontFamily: 'monospace' }}>{formatTime(entry.time2)}</td>
              <td className="text-end fw-bold" style={{ fontFamily: 'monospace', fontSize: '1.05rem' }}>
                {entry.status ? (
                  <span className="text-muted">{entry.status}</span>
                ) : formatTime(entry.time_sum)}
              </td>
              <td className="text-center">
                {entry.points != null && entry.points > 0 ? (
                  <span className="badge" style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', fontSize: '0.85rem' }}>
                    {entry.points}
                  </span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="text-center">
                {entry.status === 'DNF' && <span className="badge bg-warning text-dark">DNF</span>}
                {entry.status === 'DNS' && <span className="badge bg-secondary">DNS</span>}
                {entry.status === 'DSQ' && <span className="badge bg-danger">DSQ</span>}
                {!entry.status && entry.time_sum != null && <i className="bi bi-check-circle-fill text-success"></i>}
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-trophy me-2" style={{ color: '#e94560' }}></i>
            Výsledky závodu
          </h3>
          <p className="text-muted mb-0">Zobrazení výsledků seřazených podle času, výpočet bodů</p>
        </div>
        {results && results.total_entries > 0 && (
          <button 
            className="btn btn-lg text-white"
            style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '10px' }}
            onClick={calculatePoints}
            disabled={calculating}
          >
            {calculating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Počítám...
              </>
            ) : (
              <>
                <i className="bi bi-calculator me-2"></i>
                Vypočítat body
              </>
            )}
          </button>
        )}
      </div>

      {/* Race selector + options */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body">
          <div className="row align-items-end">
            <div className="col-md-6">
              <label className="form-label fw-semibold">
                <i className="bi bi-trophy me-1"></i> Závod
              </label>
              <select 
                className="form-select" 
                value={selectedRaceId}
                onChange={(e) => setSelectedRaceId(e.target.value)}
                style={{ borderRadius: '10px' }}
              >
                <option value="">-- Vyberte závod --</option>
                {races.map(race => (
                  <option key={race.id} value={race.id}>
                    {race.raceNr || `#${race.id}`} — {race.areal_name || 'Neznámé místo'} ({formatDate(race.datum)})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">
                <i className="bi bi-filter me-1"></i> Zobrazení
              </label>
              <div className="btn-group w-100">
                <button 
                  className={`btn ${groupByCategory ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setGroupByCategory(true)}
                >
                  <i className="bi bi-collection me-1"></i> Dle kategorií
                </button>
                <button 
                  className={`btn ${!groupByCategory ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setGroupByCategory(false)}
                >
                  <i className="bi bi-list me-1"></i> Celkově
                </button>
              </div>
            </div>
            {results && (
              <div className="col-md-3 text-end">
                <div className="mt-2">
                  <span className="text-muted">Celkem závodníků: </span>
                  <span className="fw-bold" style={{ color: '#e94560', fontSize: '1.3rem' }}>{results.total_entries}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Race info */}
      {results && (
        <div className="mb-3 d-flex gap-3 align-items-center">
          <span className="badge bg-dark" style={{ fontSize: '1rem' }}>
            <i className="bi bi-hash me-1"></i>{results.race_nr || `Závod ${results.race_id}`}
          </span>
          {results.areal_name && (
            <span className="text-muted">
              <i className="bi bi-geo-alt me-1"></i>{results.areal_name}
            </span>
          )}
          {results.race_date && (
            <span className="text-muted">
              <i className="bi bi-calendar3 me-1"></i>{formatDate(results.race_date)}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} d-flex align-items-center`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close ms-auto" onClick={() => setMessage(null)}></button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: '#e94560' }} role="status">
            <span className="visually-hidden">Načítám...</span>
          </div>
        </div>
      )}

      {/* Results grouped by category */}
      {!loading && results && results.grouped && results.categories && (
        <div>
          {results.categories.map((cat) => (
            <div key={cat.category_id} className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
              <div className="card-header bg-white" style={{ borderRadius: '12px 12px 0 0', borderBottom: '3px solid #e94560' }}>
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-tag-fill me-2" style={{ color: '#e94560' }}></i>
                  {cat.category_name}
                  <span className="badge bg-secondary ms-2 fw-normal">{cat.entries.length} závodníků</span>
                </h5>
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
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header bg-white" style={{ borderRadius: '12px 12px 0 0', borderBottom: '3px solid #e94560' }}>
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-trophy-fill me-2" style={{ color: '#e94560' }}></i>
              Celkové pořadí
            </h5>
          </div>
          <div className="card-body p-0">
            {renderEntryTable(results.entries, true)}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!loading && results && results.total_entries === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-trophy text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3 mb-1">Žádné výsledky</p>
          <p className="text-muted small">Nejprve zadejte časy na stránce Zadávání časů</p>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-5">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3">Vyberte závod pro zobrazení výsledků</p>
        </div>
      )}
    </div>
  );
}
