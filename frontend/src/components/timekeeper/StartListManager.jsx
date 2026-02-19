import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/api.js';

export default function StartListManager() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(
    localStorage.getItem('timekeeper_selected_race') || ''
  );
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  // Generation setup state
  const [showGenerateSetup, setShowGenerateSetup] = useState(false);
  const [categories, setCategories] = useState([]);
  const [numberSets, setNumberSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [loadingSetup, setLoadingSetup] = useState(false);

  // Drag & drop refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

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
    } catch (err) {
      console.error('Failed to load start list:', err);
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };

  const openGenerateSetup = async () => {
    try {
      setLoadingSetup(true);
      setShowGenerateSetup(true);
      const [cats, sets] = await Promise.all([
        TimekeeperAPI.get('/api/timekeeper/categories'),
        TimekeeperAPI.get('/api/timekeeper/race-number-sets'),
      ]);
      setCategories(cats);
      setCategoryOrder(cats.map(c => c.id));
      setNumberSets(sets);
      if (sets.length > 0) {
        setSelectedSet(String(sets[0].set_number));
      }
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst nastavení' });
      setShowGenerateSetup(false);
    } finally {
      setLoadingSetup(false);
    }
  };

  const generateStartList = async () => {
    if (!selectedRaceId) return;
    try {
      setGenerating(true);
      const body = {};
      if (selectedSet) body.set_number = parseInt(selectedSet);
      if (categoryOrder.length > 0) body.category_order = categoryOrder;
      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/generate`,
        body
      );
      setMessage({ type: 'success', text: result.message });
      setShowGenerateSetup(false);
      loadStartList();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se vygenerovat startovní listinu' });
    } finally {
      setGenerating(false);
    }
  };

  const clearStartList = async () => {
    if (!selectedRaceId) return;
    if (!window.confirm('Opravdu chcete smazat celou startovní listinu? Tato akce je nevratná.')) return;
    try {
      const result = await TimekeeperAPI.delete(`/api/timekeeper/races/${selectedRaceId}/start-list`);
      setMessage({ type: 'info', text: result.message });
      setStartList([]);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se smazat startovní listinu' });
    }
  };

  // Drag & drop handlers
  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newOrder = [...categoryOrder];
    const draggedItemId = newOrder[dragItem.current];
    newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOverItem.current, 0, draggedItemId);
    setCategoryOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const moveCategoryUp = (index) => {
    if (index === 0) return;
    const newOrder = [...categoryOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setCategoryOrder(newOrder);
  };

  const moveCategoryDown = (index) => {
    if (index === categoryOrder.length - 1) return;
    const newOrder = [...categoryOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setCategoryOrder(newOrder);
  };

  const getCategoryById = (id) => categories.find(c => c.id === id);

  const selectedRace = races.find(r => String(r.id) === String(selectedRaceId));

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Group by category
  const groupedByCategory = startList.reduce((acc, entry) => {
    const catName = entry.category_name || 'Bez kategorie';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(entry);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-list-ol me-2" style={{ color: '#e94560' }}></i>
            Startovní listina
          </h3>
          <p className="text-muted mb-0">Generování a správa startovní listiny ze zaregistrovaných závodníků</p>
        </div>
      </div>

      {/* Race selector */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body">
          <div className="row align-items-end">
            <div className="col-md-6">
              <label className="form-label fw-semibold">
                <i className="bi bi-trophy me-1"></i> Závod
              </label>
              <select 
                className="form-select form-select-lg" 
                value={selectedRaceId}
                onChange={(e) => { setSelectedRaceId(e.target.value); setShowGenerateSetup(false); }}
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
            {selectedRace && (
              <div className="col-md-6">
                <div className="d-flex gap-2 justify-content-end">
                  <button 
                    className="btn btn-lg text-white"
                    style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '10px' }}
                    onClick={showGenerateSetup ? () => setShowGenerateSetup(false) : openGenerateSetup}
                    disabled={generating}
                  >
                    <i className={`bi ${showGenerateSetup ? 'bi-x-lg' : 'bi-plus-circle'} me-2`}></i>
                    {showGenerateSetup ? 'Zrušit' : 'Generovat z registrací'}
                  </button>
                  {startList.length > 0 && (
                    <button 
                      className="btn btn-outline-danger btn-lg"
                      style={{ borderRadius: '10px' }}
                      onClick={clearStartList}
                    >
                      <i className="bi bi-trash me-1"></i>
                      Smazat
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation setup panel */}
      {showGenerateSetup && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', borderTop: '3px solid #e94560' }}>
          <div className="card-body">
            {loadingSetup ? (
              <div className="text-center py-4">
                <div className="spinner-border" style={{ color: '#e94560' }} role="status">
                  <span className="visually-hidden">Načítám...</span>
                </div>
                <p className="text-muted mt-2">Načítám nastavení...</p>
              </div>
            ) : (
              <>
                <h5 className="fw-bold mb-3">
                  <i className="bi bi-gear me-2"></i>
                  Nastavení generování
                </h5>

                <div className="row g-4">
                  {/* Set selector */}
                  <div className="col-md-4">
                    <div className="card border-0 h-100" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
                      <div className="card-body">
                        <h6 className="fw-bold mb-3">
                          <i className="bi bi-123 me-2" style={{ color: '#e94560' }}></i>
                          Sada startovních čísel
                        </h6>
                        {numberSets.length > 0 ? (
                          <div className="d-flex flex-column gap-2">
                            {numberSets.map(set => (
                              <label
                                key={set.set_number}
                                className={`d-flex align-items-center p-3 rounded-3 cursor-pointer ${
                                  String(set.set_number) === selectedSet ? 'border border-2' : 'border'
                                }`}
                                style={{
                                  background: String(set.set_number) === selectedSet ? '#fff0f3' : 'white',
                                  borderColor: String(set.set_number) === selectedSet ? '#e94560' : '#dee2e6',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <input
                                  type="radio"
                                  name="numberSet"
                                  value={set.set_number}
                                  checked={String(set.set_number) === selectedSet}
                                  onChange={(e) => setSelectedSet(e.target.value)}
                                  className="form-check-input me-3"
                                  style={{ accentColor: '#e94560' }}
                                />
                                <div>
                                  <div className="fw-semibold">Sada {set.set_number}</div>
                                  <small className="text-muted">
                                    Čísla {set.min_display}–{set.max_display} ({set.count} ks)
                                  </small>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-3">
                            <p className="text-muted small mb-2">Žádné sady čísel</p>
                            <a href="/timekeeper/race-numbers" className="btn btn-sm btn-outline-secondary">
                              <i className="bi bi-plus me-1"></i>Vytvořit sadu
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category ordering */}
                  <div className="col-md-8">
                    <div className="card border-0 h-100" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-bold mb-0">
                            <i className="bi bi-arrow-down-up me-2" style={{ color: '#e94560' }}></i>
                            Pořadí kategorií na startu
                          </h6>
                          <small className="text-muted">
                            <i className="bi bi-grip-vertical me-1"></i>
                            Přetáhněte pro změnu pořadí
                          </small>
                        </div>

                        <div className="d-flex flex-column gap-1">
                          {categoryOrder.map((catId, index) => {
                            const cat = getCategoryById(catId);
                            if (!cat) return null;
                            return (
                              <div
                                key={catId}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragEnter={() => handleDragEnter(index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className="d-flex align-items-center p-2 px-3 rounded-2"
                                style={{
                                  background: 'white',
                                  border: '1px solid #dee2e6',
                                  cursor: 'grab',
                                  transition: 'box-shadow 0.15s ease',
                                  userSelect: 'none',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                                onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                              >
                                <span className="text-muted me-3" style={{ minWidth: '28px', textAlign: 'center' }}>
                                  <i className="bi bi-grip-vertical"></i>
                                </span>
                                <span
                                  className="badge me-3"
                                  style={{
                                    background: 'linear-gradient(135deg, #e94560, #c23152)',
                                    minWidth: '30px',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {index + 1}
                                </span>
                                <span className="fw-semibold flex-grow-1">
                                  {cat.name}
                                </span>
                                <span className="text-muted small me-3">
                                  {cat.sex === 2 ? '♀ ženy' : '♂ muži'}
                                </span>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-secondary btn-sm py-0 px-1"
                                    onClick={(e) => { e.stopPropagation(); moveCategoryUp(index); }}
                                    disabled={index === 0}
                                    title="Posunout nahoru"
                                    style={{ borderRadius: '6px 0 0 6px' }}
                                  >
                                    <i className="bi bi-chevron-up"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-secondary btn-sm py-0 px-1"
                                    onClick={(e) => { e.stopPropagation(); moveCategoryDown(index); }}
                                    disabled={index === categoryOrder.length - 1}
                                    title="Posunout dolů"
                                    style={{ borderRadius: '0 6px 6px 0' }}
                                  >
                                    <i className="bi bi-chevron-down"></i>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <div className="mt-4 d-flex justify-content-end">
                  <button
                    className="btn btn-lg text-white px-4"
                    style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '10px' }}
                    onClick={generateStartList}
                    disabled={generating || (!selectedSet && numberSets.length > 0)}
                  >
                    {generating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Generuji startovní listinu...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-lightning me-2"></i>
                        Vygenerovat startovní listinu
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} d-flex align-items-center`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : message.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2`}></i>
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

      {/* Start list */}
      {!loading && selectedRaceId && startList.length > 0 && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-semibold mb-0">
              Závodníků na listině: <span style={{ color: '#e94560' }}>{startList.length}</span>
            </h5>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/timekeeper/timing')}
            >
              <i className="bi bi-clock me-1"></i>
              Přejít na zadávání časů
            </button>
          </div>

          {Object.entries(groupedByCategory).map(([catName, entries]) => (
            <div key={catName} className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
              <div className="card-header bg-white border-bottom" style={{ borderRadius: '12px 12px 0 0' }}>
                <h6 className="mb-0 fw-bold">
                  <i className="bi bi-tag-fill me-2" style={{ color: '#e94560' }}></i>
                  {catName}
                  <span className="badge bg-secondary ms-2">{entries.length}</span>
                </h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '60px' }}>St. č.</th>
                        <th style={{ width: '80px' }}>Záv. č.</th>
                        <th>Závodník</th>
                        <th style={{ width: '80px' }}>Ročník</th>
                        <th>Klub</th>
                        <th style={{ width: '100px' }}>Čas 1</th>
                        <th style={{ width: '100px' }}>Čas 2</th>
                        <th style={{ width: '100px' }}>Součet</th>
                        <th style={{ width: '80px' }}>Stav</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(entry => (
                        <tr key={entry.id}>
                          <td className="fw-bold">{entry.start_number || '—'}</td>
                          <td>
                            {entry.display_number ? (
                              <span className="badge bg-dark">{entry.display_number}</span>
                            ) : '—'}
                          </td>
                          <td className="fw-semibold">{entry.racer_surname} {entry.racer_name}</td>
                          <td>{entry.racer_year}</td>
                          <td className="text-muted">{entry.club_name || '—'}</td>
                          <td>{entry.time1 != null ? entry.time1.toFixed(2) : '—'}</td>
                          <td>{entry.time2 != null ? entry.time2.toFixed(2) : '—'}</td>
                          <td className="fw-bold">
                            {entry.time_sum != null ? entry.time_sum.toFixed(2) : '—'}
                          </td>
                          <td>
                            {entry.dnf && <span className="badge bg-warning">DNF</span>}
                            {entry.dns && <span className="badge bg-secondary">DNS</span>}
                            {entry.dsq && <span className="badge bg-danger">DSQ</span>}
                            {!entry.dnf && !entry.dns && !entry.dsq && (
                              <span className="badge bg-success">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && selectedRaceId && startList.length === 0 && !showGenerateSetup && (
        <div className="text-center py-5">
          <i className="bi bi-list-ul text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3 mb-1">Startovní listina je prázdná</p>
          <p className="text-muted small">Klikněte na "Generovat z registrací" pro vytvoření listiny ze zaregistrovaných závodníků</p>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-5">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3">Vyberte závod pro zobrazení startovní listiny</p>
        </div>
      )}
    </div>
  );
}
