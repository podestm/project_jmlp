import React, { useState, useEffect, useRef } from 'react';
import { TimekeeperAPI } from '../../config/api.js';

export default function TimingEntry() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(
    localStorage.getItem('timekeeper_selected_race') || ''
  );
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editedTimes, setEditedTimes] = useState({});
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [activeRound, setActiveRound] = useState('both'); // 'both', '1', '2'
  const inputRefs = useRef({});

  useEffect(() => {
    loadRaces();
  }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadStartList();
      localStorage.setItem('timekeeper_selected_race', selectedRaceId);
    }
  }, [selectedRaceId]);

  const loadRaces = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) {
      console.error('Failed to load races:', err);
    }
  };

  const loadStartList = async () => {
    if (!selectedRaceId) return;
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/races/${selectedRaceId}/start-list`);
      setStartList(data);
      // Init edited times from existing data
      const times = {};
      data.forEach(entry => {
        times[entry.id] = {
          time1: entry.time1 != null ? String(entry.time1) : '',
          time2: entry.time2 != null ? String(entry.time2) : '',
          dnf: entry.dnf || false,
          dns: entry.dns || false,
          dsq: entry.dsq || false,
        };
      });
      setEditedTimes(times);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };

  const updateTime = (entryId, field, value) => {
    setEditedTimes(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value
      }
    }));
  };

  const toggleFlag = (entryId, flag) => {
    setEditedTimes(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [flag]: !prev[entryId]?.[flag]
      }
    }));
  };

  const saveAllTimes = async () => {
    if (!selectedRaceId) return;
    try {
      setSaving(true);
      const entries = Object.entries(editedTimes).map(([id, data]) => ({
        entry_id: parseInt(id),
        time1: data.time1 !== '' ? parseFloat(data.time1) : null,
        time2: data.time2 !== '' ? parseFloat(data.time2) : null,
        dnf: data.dnf || false,
        dns: data.dns || false,
        dsq: data.dsq || false,
      }));

      const result = await TimekeeperAPI.post(`/api/timekeeper/races/${selectedRaceId}/times`, {
        entries
      });
      setMessage({ type: 'success', text: result.message });
      loadStartList(); // Reload to get updated time_sum
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se uložit časy' });
    } finally {
      setSaving(false);
    }
  };

  const saveSingleTime = async (entryId) => {
    const data = editedTimes[entryId];
    if (!data) return;
    try {
      const update = {};
      if (data.time1 !== '') update.time1 = parseFloat(data.time1);
      else update.time1 = null;
      if (data.time2 !== '') update.time2 = parseFloat(data.time2);
      else update.time2 = null;
      update.dnf = data.dnf || false;
      update.dns = data.dns || false;
      update.dsq = data.dsq || false;

      await TimekeeperAPI.put(`/api/timekeeper/start-list/${entryId}/time`, update);
      
      // Reload to update time_sum
      loadStartList();
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se uložit čas' });
    }
  };

  // Handle Enter key to move to next input
  const handleKeyDown = (e, entryId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save this entry
      saveSingleTime(entryId);
      
      // Move to next entry's same field (or active field)
      const currentIndex = filteredList.findIndex(entry => entry.id === entryId);
      if (currentIndex < filteredList.length - 1) {
        const nextId = filteredList[currentIndex + 1].id;
        // When round is locked, jump to same field; otherwise next available
        const nextField = activeRound === '1' ? 'time1' : activeRound === '2' ? 'time2' : field;
        const nextRef = inputRefs.current[`${nextId}-${nextField}`];
        if (nextRef) nextRef.focus();
      }
    }
    // Tab to move to time2 of same entry (only when both rounds active)
    if (e.key === 'Tab' && !e.shiftKey && field === 'time1') {
      if (activeRound === 'both') {
        e.preventDefault();
        const ref = inputRefs.current[`${entryId}-time2`];
        if (ref) ref.focus();
      } else if (activeRound === '1') {
        // Skip to next entry's time1
        e.preventDefault();
        const currentIndex = filteredList.findIndex(entry => entry.id === entryId);
        if (currentIndex < filteredList.length - 1) {
          const nextId = filteredList[currentIndex + 1].id;
          const nextRef = inputRefs.current[`${nextId}-time1`];
          if (nextRef) nextRef.focus();
        }
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Filter logic
  const filteredList = startList.filter(entry => {
    if (filter === 'pending') {
      return entry.time1 == null && entry.time2 == null && !entry.dnf && !entry.dns && !entry.dsq;
    }
    if (filter === 'completed') {
      return entry.time1 != null || entry.time2 != null || entry.dnf || entry.dns || entry.dsq;
    }
    return true;
  });

  const completedCount = startList.filter(e => e.time1 != null || e.time2 != null || e.dnf || e.dns || e.dsq).length;

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-clock me-2" style={{ color: '#e94560' }}></i>
            Zadávání časů
          </h3>
          <p className="text-muted mb-0">Zapište časy jednotlivých jízd pro každého závodníka</p>
        </div>
        {startList.length > 0 && (
          <button 
            className="btn btn-lg text-white"
            style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '10px' }}
            onClick={saveAllTimes}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Ukládám...
              </>
            ) : (
              <>
                <i className="bi bi-save me-2"></i>
                Uložit všechny časy
              </>
            )}
          </button>
        )}
      </div>

      {/* Race selector */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body">
          <div className="row align-items-end">
            <div className="col-md-5">
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
            {startList.length > 0 && (
              <>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-funnel me-1"></i> Filtr
                  </label>
                  <div className="btn-group w-100">
                    <button 
                      className={`btn ${filter === 'all' ? 'btn-dark' : 'btn-outline-dark'}`}
                      onClick={() => setFilter('all')}
                    >
                      Vše ({startList.length})
                    </button>
                    <button 
                      className={`btn ${filter === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => setFilter('pending')}
                    >
                      Čekající ({startList.length - completedCount})
                    </button>
                    <button 
                      className={`btn ${filter === 'completed' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setFilter('completed')}
                    >
                      Hotovo ({completedCount})
                    </button>
                  </div>
                </div>
                <div className="col-md-3 text-end">
                  <div className="mt-2">
                    <div className="progress" style={{ height: '24px', borderRadius: '12px' }}>
                      <div 
                        className="progress-bar" 
                        style={{ 
                          width: `${startList.length > 0 ? (completedCount / startList.length * 100) : 0}%`,
                          background: 'linear-gradient(135deg, #e94560, #c23152)',
                          borderRadius: '12px'
                        }}
                      >
                        {startList.length > 0 ? Math.round(completedCount / startList.length * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Round toggle */}
      {!loading && selectedRaceId && startList.length > 0 && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
          <div className="card-body py-3">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <span className="fw-semibold me-3">
                  <i className="bi bi-toggles me-1" style={{ color: '#e94560' }}></i>
                  Aktivní kolo:
                </span>
                <div className="btn-group">
                  <button
                    className={`btn ${activeRound === '1' ? '' : 'btn-outline-dark'}`}
                    style={activeRound === '1' ? {
                      background: 'linear-gradient(135deg, #e94560, #c23152)',
                      color: 'white',
                      border: 'none',
                    } : {}}
                    onClick={() => setActiveRound('1')}
                  >
                    <i className="bi bi-1-circle me-1"></i> Kolo 1
                  </button>
                  <button
                    className={`btn ${activeRound === '2' ? '' : 'btn-outline-dark'}`}
                    style={activeRound === '2' ? {
                      background: 'linear-gradient(135deg, #e94560, #c23152)',
                      color: 'white',
                      border: 'none',
                    } : {}}
                    onClick={() => setActiveRound('2')}
                  >
                    <i className="bi bi-2-circle me-1"></i> Kolo 2
                  </button>
                  <button
                    className={`btn ${activeRound === 'both' ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => setActiveRound('both')}
                  >
                    <i className="bi bi-circle-half me-1"></i> Obě kola
                  </button>
                </div>
              </div>
              {activeRound !== 'both' && (
                <span className="badge bg-warning text-dark">
                  <i className="bi bi-lock me-1"></i>
                  {activeRound === '1' ? 'Kolo 2 zamčeno' : 'Kolo 1 zamčeno'}
                </span>
              )}
            </div>
          </div>
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

      {/* Timing table */}
      {!loading && selectedRaceId && filteredList.length > 0 && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead style={{ background: '#1a1a2e', color: '#fff' }}>
                  <tr>
                    <th style={{ width: '50px', borderRadius: '12px 0 0 0' }}>St.č.</th>
                    <th style={{ width: '60px' }}>Č.</th>
                    <th>Závodník</th>
                    <th>Klub</th>
                    <th style={{ width: '130px', ...(activeRound === '2' ? { opacity: 0.5 } : {}) }}>
                      <i className="bi bi-1-circle me-1"></i> Jízda 1
                      {activeRound === '2' && <i className="bi bi-lock-fill ms-1" style={{ fontSize: '0.7rem' }}></i>}
                    </th>
                    <th style={{ width: '130px', ...(activeRound === '1' ? { opacity: 0.5 } : {}) }}>
                      <i className="bi bi-2-circle me-1"></i> Jízda 2
                      {activeRound === '1' && <i className="bi bi-lock-fill ms-1" style={{ fontSize: '0.7rem' }}></i>}
                    </th>
                    <th style={{ width: '100px' }}>Součet</th>
                    <th style={{ width: '160px', borderRadius: '0 12px 0 0' }}>Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((entry, index) => {
                    const times = editedTimes[entry.id] || {};
                    const hasFlag = times.dnf || times.dns || times.dsq;
                    
                    return (
                      <tr key={entry.id} className={hasFlag ? 'table-light' : ''}>
                        <td className="fw-bold text-center">{entry.start_number || '—'}</td>
                        <td>
                          {entry.display_number ? (
                            <span className="badge bg-dark">{entry.display_number}</span>
                          ) : '—'}
                        </td>
                        <td>
                          <div className="fw-semibold">{entry.racer_surname} {entry.racer_name}</div>
                          <small className="text-muted">
                            {entry.racer_year} | {entry.category_name || 'Bez kat.'}
                          </small>
                        </td>
                        <td className="text-muted small">{entry.club_name || '—'}</td>
                        <td>
                          <input 
                            ref={el => inputRefs.current[`${entry.id}-time1`] = el}
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm"
                            style={{ 
                              borderRadius: '8px', fontFamily: 'monospace', fontSize: '1rem',
                              ...(activeRound === '2' ? { background: '#f0f0f0', opacity: 0.6 } : {})
                            }}
                            value={times.time1 || ''}
                            onChange={(e) => updateTime(entry.id, 'time1', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, entry.id, 'time1')}
                            onBlur={() => saveSingleTime(entry.id)}
                            placeholder="0.00"
                            disabled={hasFlag || activeRound === '2'}
                          />
                        </td>
                        <td>
                          <input 
                            ref={el => inputRefs.current[`${entry.id}-time2`] = el}
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm"
                            style={{ 
                              borderRadius: '8px', fontFamily: 'monospace', fontSize: '1rem',
                              ...(activeRound === '1' ? { background: '#f0f0f0', opacity: 0.6 } : {})
                            }}
                            value={times.time2 || ''}
                            onChange={(e) => updateTime(entry.id, 'time2', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, entry.id, 'time2')}
                            onBlur={() => saveSingleTime(entry.id)}
                            placeholder="0.00"
                            disabled={hasFlag || activeRound === '1'}
                          />
                        </td>
                        <td className="fw-bold text-center" style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                          {entry.time_sum != null ? entry.time_sum.toFixed(2) : '—'}
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              className={`btn ${times.dnf ? 'btn-warning' : 'btn-outline-warning'}`}
                              onClick={() => { toggleFlag(entry.id, 'dnf'); setTimeout(() => saveSingleTime(entry.id), 100); }}
                              title="Did Not Finish"
                              style={{ borderRadius: '8px 0 0 8px', fontSize: '0.75rem' }}
                            >
                              DNF
                            </button>
                            <button
                              className={`btn ${times.dns ? 'btn-secondary' : 'btn-outline-secondary'}`}
                              onClick={() => { toggleFlag(entry.id, 'dns'); setTimeout(() => saveSingleTime(entry.id), 100); }}
                              title="Did Not Start"
                              style={{ fontSize: '0.75rem' }}
                            >
                              DNS
                            </button>
                            <button
                              className={`btn ${times.dsq ? 'btn-danger' : 'btn-outline-danger'}`}
                              onClick={() => { toggleFlag(entry.id, 'dsq'); setTimeout(() => saveSingleTime(entry.id), 100); }}
                              title="Disqualified"
                              style={{ borderRadius: '0 8px 8px 0', fontSize: '0.75rem' }}
                            >
                              DSQ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty states */}
      {!loading && selectedRaceId && startList.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-list-ul text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3 mb-1">Startovní listina je prázdná</p>
          <p className="text-muted small">Nejprve vygenerujte startovní listinu</p>
          <a href="/timekeeper/start-list" className="btn btn-outline-primary mt-2">
            <i className="bi bi-list-ol me-1"></i> Přejít na startovní listinu
          </a>
        </div>
      )}

      {!loading && selectedRaceId && filteredList.length === 0 && startList.length > 0 && (
        <div className="text-center py-5">
          <i className="bi bi-check-circle text-success" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3">Žádné záznamy pro vybraný filtr</p>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-5">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3">Vyberte závod pro zadávání časů</p>
        </div>
      )}
    </div>
  );
}
