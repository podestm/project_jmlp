import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' or category_name
  const inputRefs = useRef({});
  const editedTimesRef = useRef({});
  const savingEntriesRef = useRef(new Set());
  const skipBlurRef = useRef(null);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadStartList();
      localStorage.setItem('timekeeper_selected_race', selectedRaceId);
    }
  }, [selectedRaceId]);

  useEffect(() => {
    editedTimesRef.current = editedTimes;
  }, [editedTimes]);

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
      setSelectedCategory('all');
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };

  const updateTime = (entryId, field, value) => {
    setEditedTimes(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value }
    }));
  };

  const parseStoredTime = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const calculateTimeSum = (data) => {
    if (data.dnf || data.dns || data.dsq) return null;
    const time1 = parseStoredTime(data.time1);
    const time2 = parseStoredTime(data.time2);
    if (time1 != null && time2 != null) return time1 + time2;
    if (time1 != null) return time1;
    if (time2 != null) return time2;
    return null;
  };

  const applySavedEntryToStartList = (entryId, data) => {
    const time1 = parseStoredTime(data.time1);
    const time2 = parseStoredTime(data.time2);
    const timeSum = calculateTimeSum(data);

    setStartList(prev => prev.map(entry => (
      entry.id === entryId
        ? {
            ...entry,
            time1,
            time2,
            dnf: Boolean(data.dnf),
            dns: Boolean(data.dns),
            dsq: Boolean(data.dsq),
            time_sum: timeSum,
          }
        : entry
    )));
  };

  const buildTimeUpdate = (data) => ({
    time1: data.time1 !== '' ? parseFloat(data.time1) : null,
    time2: data.time2 !== '' ? parseFloat(data.time2) : null,
    dnf: data.dnf || false,
    dns: data.dns || false,
    dsq: data.dsq || false,
  });

  const focusInput = (entryId, field) => {
    const ref = inputRefs.current[`${entryId}-${field}`];
    if (ref) {
      ref.focus();
      ref.select();
    }
  };

  const focusNextInput = (entryId, field) => {
    const currentIndex = filteredList.findIndex(entry => entry.id === entryId);
    if (currentIndex === -1) return;

    if (field === 'time1') {
      if (activeRound === 'both') {
        focusInput(entryId, 'time2');
        return;
      }
      if (currentIndex < filteredList.length - 1) {
        focusInput(filteredList[currentIndex + 1].id, 'time1');
      }
      return;
    }

    if (currentIndex < filteredList.length - 1) {
      const nextField = activeRound === '2' ? 'time2' : 'time1';
      focusInput(filteredList[currentIndex + 1].id, nextField);
    }
  };

  const saveEntry = async (entryId, data, errorText) => {
    if (!data || savingEntriesRef.current.has(entryId)) return false;

    try {
      savingEntriesRef.current.add(entryId);
      await TimekeeperAPI.put(`/api/timekeeper/start-list/${entryId}/time`, buildTimeUpdate(data));
      applySavedEntryToStartList(entryId, data);
      return true;
    } catch (err) {
      setMessage({ type: 'danger', text: errorText });
      return false;
    } finally {
      savingEntriesRef.current.delete(entryId);
    }
  };

  const toggleFlag = (entryId, flag) => {
    setEditedTimes(prev => {
      const updated = { ...prev[entryId], [flag]: !prev[entryId]?.[flag] };
      // Save immediately with the new values (avoid stale state race condition)
      saveFlagUpdate(entryId, updated);
      return { ...prev, [entryId]: updated };
    });
  };

  const saveFlagUpdate = async (entryId, data) => {
    if (!data) return;
    await saveEntry(entryId, data, 'Nepodařilo se uložit stav');
  };

  const saveAllTimes = async () => {
    if (!selectedRaceId) return;
    try {
      setSaving(true);
      const entries = Object.entries(editedTimesRef.current).map(([id, data]) => ({
        entry_id: parseInt(id),
        time1: data.time1 !== '' ? parseFloat(data.time1) : null,
        time2: data.time2 !== '' ? parseFloat(data.time2) : null,
        dnf: data.dnf || false,
        dns: data.dns || false,
        dsq: data.dsq || false,
      }));
      const result = await TimekeeperAPI.post(`/api/timekeeper/races/${selectedRaceId}/times`, { entries });
      Object.entries(editedTimesRef.current).forEach(([id, data]) => {
        applySavedEntryToStartList(parseInt(id), data);
      });
      setMessage({ type: 'success', text: result.message });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se uložit časy' });
    } finally {
      setSaving(false);
    }
  };

  const saveSingleTime = async (entryId) => {
    const data = editedTimesRef.current[entryId];
    if (!data) return false;
    return saveEntry(entryId, data, 'Nepodařilo se uložit čas');
  };

  const handleBlur = (entryId, field) => {
    const blurKey = `${entryId}-${field}`;
    if (skipBlurRef.current === blurKey) {
      skipBlurRef.current = null;
      return;
    }
    saveSingleTime(entryId);
  };

  const handleKeyDown = async (e, entryId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      skipBlurRef.current = `${entryId}-${field}`;
      await saveSingleTime(entryId);
      if (field === 'time1' && activeRound === 'both') {
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
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Get unique categories from start list
  const categoryList = useMemo(() => {
    const cats = new Map();
    startList.forEach(entry => {
      const catName = entry.category_name || 'Bez kategorie';
      if (!cats.has(catName)) {
        cats.set(catName, { name: catName, count: 0 });
      }
      cats.get(catName).count++;
    });
    return [...cats.values()];
  }, [startList]);

  // Filter by category first, then by status filter
  const categoryFiltered = selectedCategory === 'all'
    ? startList
    : startList.filter(e => (e.category_name || 'Bez kategorie') === selectedCategory);

  const filteredList = categoryFiltered.filter(entry => {
    if (filter === 'pending') {
      return entry.time1 == null && entry.time2 == null && !entry.dnf && !entry.dns && !entry.dsq;
    }
    if (filter === 'completed') {
      return entry.time1 != null || entry.time2 != null || entry.dnf || entry.dns || entry.dsq;
    }
    return true;
  });

  const completedCount = categoryFiltered.filter(e => e.time1 != null || e.time2 != null || e.dnf || e.dns || e.dsq).length;
  const selectedRace = races.find(r => String(r.id) === String(selectedRaceId));

  return (
    <div>
      {/* Header with save button */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-clock me-2" style={{ color: '#e94560' }}></i>
            Zadávání časů
          </h5>
          <small className="text-muted">Zapište časy jízd pro závodníky</small>
        </div>
        {startList.length > 0 && (
          <button
            className="btn btn-sm text-white"
            style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
            onClick={saveAllTimes}
            disabled={saving}
          >
            {saving ? (
              <><span className="spinner-border spinner-border-sm me-1"></span>Ukládám...</>
            ) : (
              <><i className="bi bi-save me-1"></i>Uložit vše</>
            )}
          </button>
        )}
      </div>

      {/* Race info bar (static - no dropdown) */}
      {selectedRace ? (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
                <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  {selectedRace.raceNr || `#${selectedRace.id}`} — {selectedRace.areal_name || '?'}
                </span>
                <small className="text-muted">({formatDate(selectedRace.datum)})</small>
              </div>
              <div className="d-flex align-items-center gap-2">
                {/* Status filter */}
                {startList.length > 0 && (
                  <div className="btn-group btn-group-sm">
                    <button className={`btn py-0 px-2 ${filter === 'all' ? 'btn-dark' : 'btn-outline-dark'}`}
                      style={{ fontSize: '0.75rem' }} onClick={() => setFilter('all')}>
                      Vše ({categoryFiltered.length})
                    </button>
                    <button className={`btn py-0 px-2 ${filter === 'pending' ? 'btn-warning' : 'btn-outline-warning'}`}
                      style={{ fontSize: '0.75rem' }} onClick={() => setFilter('pending')}>
                      Čeká ({categoryFiltered.length - completedCount})
                    </button>
                    <button className={`btn py-0 px-2 ${filter === 'completed' ? 'btn-success' : 'btn-outline-success'}`}
                      style={{ fontSize: '0.75rem' }} onClick={() => setFilter('completed')}>
                      Hotovo ({completedCount})
                    </button>
                  </div>
                )}
                {/* Progress */}
                {startList.length > 0 && (
                  <div style={{ width: '80px' }}>
                    <div className="progress" style={{ height: '16px', borderRadius: '8px' }}>
                      <div className="progress-bar" style={{
                        width: `${categoryFiltered.length > 0 ? (completedCount / categoryFiltered.length * 100) : 0}%`,
                        background: 'linear-gradient(135deg, #e94560, #c23152)', borderRadius: '8px', fontSize: '0.65rem'
                      }}>
                        {categoryFiltered.length > 0 ? Math.round(completedCount / categoryFiltered.length * 100) : 0}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Race selector only when no race selected */
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
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
        </div>
      )}

      {/* Category tabs + Round toggle row */}
      {!loading && selectedRaceId && startList.length > 0 && (
        <div className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              {/* Category pills */}
              <div className="d-flex align-items-center gap-1 flex-wrap">
                <small className="fw-semibold me-1" style={{ color: '#e94560' }}>
                  <i className="bi bi-tag me-1"></i>Kat:
                </small>
                <button
                  className={`btn py-0 px-2 ${selectedCategory === 'all' ? '' : 'btn-outline-dark'}`}
                  style={{
                    fontSize: '0.75rem', borderRadius: '12px',
                    ...(selectedCategory === 'all' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                  }}
                  onClick={() => setSelectedCategory('all')}
                >
                  Vše ({startList.length})
                </button>
                {categoryList.map(cat => (
                  <button key={cat.name}
                    className={`btn py-0 px-2 ${selectedCategory === cat.name ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem', borderRadius: '12px',
                      ...(selectedCategory === cat.name ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>

              {/* Round toggle */}
              <div className="d-flex align-items-center gap-2">
                <small className="fw-semibold" style={{ color: '#e94560' }}>
                  <i className="bi bi-toggles me-1"></i>Kolo:
                </small>
                <div className="btn-group btn-group-sm">
                  <button className={`btn py-0 px-2 ${activeRound === '1' ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem',
                      ...(activeRound === '1' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setActiveRound('1')}>1</button>
                  <button className={`btn py-0 px-2 ${activeRound === '2' ? '' : 'btn-outline-dark'}`}
                    style={{
                      fontSize: '0.75rem',
                      ...(activeRound === '2' ? { background: '#e94560', color: 'white', border: 'none' } : {})
                    }}
                    onClick={() => setActiveRound('2')}>2</button>
                  <button className={`btn py-0 px-2 ${activeRound === 'both' ? 'btn-dark' : 'btn-outline-dark'}`}
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setActiveRound('both')}>Obě</button>
                </div>
                {activeRound !== 'both' && (
                  <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                    <i className="bi bi-lock me-1"></i>{activeRound === '1' ? 'K2 zamčeno' : 'K1 zamčeno'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Timing table */}
      {!loading && selectedRaceId && filteredList.length > 0 && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
                <thead style={{ background: '#1a1a2e', color: '#fff' }}>
                  <tr>
                    <th style={{ width: '85px', padding: '5px 8px', borderRadius: '10px 0 0 0' }}>Pořadí</th>
                    <th style={{ width: '125px', padding: '5px 8px' }}>St. číslo</th>
                    <th style={{ padding: '5px 8px' }}>Závodník</th>
                    <th style={{ padding: '5px 8px' }}>Klub</th>
                    <th style={{ width: '110px', padding: '5px 8px', ...(activeRound === '2' ? { opacity: 0.5 } : {}) }}>
                      Jízda 1 {activeRound === '2' && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem' }}></i>}
                    </th>
                    <th style={{ width: '110px', padding: '5px 8px', ...(activeRound === '1' ? { opacity: 0.5 } : {}) }}>
                      Jízda 2 {activeRound === '1' && <i className="bi bi-lock-fill" style={{ fontSize: '0.6rem' }}></i>}
                    </th>
                    <th style={{ width: '75px', padding: '5px 8px' }}>Součet</th>
                    <th style={{ width: '130px', padding: '5px 8px', borderRadius: '0 10px 0 0' }}>Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((entry) => {
                    const times = editedTimes[entry.id] || {};
                    const hasFlag = times.dnf || times.dns || times.dsq;

                    return (
                      <tr key={entry.id} className={hasFlag ? 'table-light' : ''}>
                        <td className="fw-bold text-center" style={{ padding: '3px 8px' }}>{entry.start_number || '—'}</td>
                        <td style={{ padding: '3px 8px' }}>
                          {entry.race_number_display ? (
                            <>
                              <span className="badge bg-dark" style={{ fontSize: '0.7rem' }}>{entry.race_number_display}</span>
                              <small className="text-muted d-block mt-1">Číslo dresu: {entry.race_number_actual || '—'}</small>
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '3px 8px' }}>
                          <span className="fw-semibold">{entry.racer_surname} {entry.racer_name}</span>
                          {selectedCategory === 'all' && (
                            <small className="text-muted ms-1">| {entry.category_name || '?'}</small>
                          )}
                          <small className="text-muted ms-1">({entry.racer_year})</small>
                        </td>
                        <td className="text-muted" style={{ padding: '3px 8px', fontSize: '0.8rem' }}>{entry.club_name || '—'}</td>
                        <td style={{ padding: '3px 6px' }}>
                          <input
                            ref={el => inputRefs.current[`${entry.id}-time1`] = el}
                            type="number" step="0.01" min="0"
                            className="form-control form-control-sm"
                            style={{
                              borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', padding: '2px 6px',
                              ...(activeRound === '2' ? { background: '#f0f0f0', opacity: 0.6 } : {})
                            }}
                            value={times.time1 || ''}
                            onChange={(e) => updateTime(entry.id, 'time1', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, entry.id, 'time1')}
                            onBlur={() => handleBlur(entry.id, 'time1')}
                            placeholder="0.00"
                            disabled={hasFlag || activeRound === '2'}
                          />
                        </td>
                        <td style={{ padding: '3px 6px' }}>
                          <input
                            ref={el => inputRefs.current[`${entry.id}-time2`] = el}
                            type="number" step="0.01" min="0"
                            className="form-control form-control-sm"
                            style={{
                              borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', padding: '2px 6px',
                              ...(activeRound === '1' ? { background: '#f0f0f0', opacity: 0.6 } : {})
                            }}
                            value={times.time2 || ''}
                            onChange={(e) => updateTime(entry.id, 'time2', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, entry.id, 'time2')}
                            onBlur={() => handleBlur(entry.id, 'time2')}
                            placeholder="0.00"
                            disabled={hasFlag || activeRound === '1'}
                          />
                        </td>
                        <td className="fw-bold text-center" style={{ padding: '3px 8px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          {hasFlag
                            ? (times.dnf ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.7rem' }}>DNF</span>
                              : times.dns ? <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>DNS</span>
                              : <span className="badge bg-danger" style={{ fontSize: '0.7rem' }}>DSQ</span>)
                            : (entry.time_sum != null ? entry.time_sum.toFixed(2) : '—')}
                        </td>
                        <td style={{ padding: '3px 6px' }}>
                          <div className="btn-group btn-group-sm">
                            <button className={`btn py-0 px-1 ${times.dnf ? 'btn-warning' : 'btn-outline-warning'}`}
                              style={{ fontSize: '0.7rem', borderRadius: '6px 0 0 6px' }}
                              onClick={() => toggleFlag(entry.id, 'dnf')}
                              title="Did Not Finish">DNF</button>
                            <button className={`btn py-0 px-1 ${times.dns ? 'btn-secondary' : 'btn-outline-secondary'}`}
                              style={{ fontSize: '0.7rem' }}
                              onClick={() => toggleFlag(entry.id, 'dns')}
                              title="Did Not Start">DNS</button>
                            <button className={`btn py-0 px-1 ${times.dsq ? 'btn-danger' : 'btn-outline-danger'}`}
                              style={{ fontSize: '0.7rem', borderRadius: '0 6px 6px 0' }}
                              onClick={() => toggleFlag(entry.id, 'dsq')}
                              title="Disqualified">DSQ</button>
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
        <div className="text-center py-4">
          <i className="bi bi-list-ul text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 mb-0 small">Startovní listina je prázdná</p>
          <a href="/timekeeper/start-list" className="btn btn-sm btn-outline-primary mt-2">
            <i className="bi bi-list-ol me-1"></i>Přejít na startovní listinu
          </a>
        </div>
      )}

      {!loading && selectedRaceId && filteredList.length === 0 && startList.length > 0 && (
        <div className="text-center py-4">
          <i className="bi bi-check-circle text-success" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Žádné záznamy pro vybraný filtr</p>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-4">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Vyberte závod pro zadávání časů</p>
        </div>
      )}
    </div>
  );
}
