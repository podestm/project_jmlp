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
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [loadingSetup, setLoadingSetup] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Manual add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ racer_id: '', category_id: '', start_number: '', name_override: '', surname_override: '', year_override: '' });
  const [racerSearch, setRacerSearch] = useState('');
  const [racerResults, setRacerResults] = useState([]);
  const [searchingRacers, setSearchingRacers] = useState(false);

  // Drag & drop refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => { loadRaces(); }, []);

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
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst startovní listinu' });
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesIfNeeded = async () => {
    if (categories.length === 0) {
      try {
        const cats = await TimekeeperAPI.get('/api/timekeeper/categories');
        setCategories(cats);
      } catch (err) { /* silent */ }
    }
  };

  const openGenerateSetup = async () => {
    try {
      setLoadingSetup(true);
      setShowGenerateSetup(true);
      const cats = await TimekeeperAPI.get('/api/timekeeper/categories');
      setCategories(cats);
      setCategoryOrder(cats.map(c => c.id));
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
      if (categoryOrder.length > 0) body.category_order = categoryOrder;
      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/generate`, body
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

  // --- Inline editing ---
  const startEditing = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      start_number: entry.start_number || '',
      name_override: entry.has_override && entry.racer_name ? entry.racer_name : '',
      surname_override: entry.has_override && entry.racer_surname ? entry.racer_surname : '',
      year_override: entry.has_override && entry.racer_year ? entry.racer_year : '',
      category_id: entry.category_id || '',
    });
    loadCategoriesIfNeeded();
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = async () => {
    if (!editingId) return;
    try {
      const body = {};
      if (editForm.start_number !== '') body.start_number = parseInt(editForm.start_number);
      if (editForm.category_id !== '') body.category_id = parseInt(editForm.category_id);
      if (editForm.name_override && editForm.name_override.trim()) body.name_override = editForm.name_override.trim();
      else body.name_override = null;
      if (editForm.surname_override && editForm.surname_override.trim()) body.surname_override = editForm.surname_override.trim();
      else body.surname_override = null;
      if (editForm.year_override !== '' && editForm.year_override !== null && editForm.year_override !== undefined) body.year_override = parseInt(editForm.year_override);
      else body.year_override = null;

      await TimekeeperAPI.put(`/api/timekeeper/start-list/${editingId}`, body);
      setEditingId(null);
      setEditForm({});
      loadStartList();
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se uložit změny' });
    }
  };

  const deleteEntry = async (entryId, name) => {
    if (!window.confirm(`Odebrat ${name} ze startovní listiny?`)) return;
    try {
      await TimekeeperAPI.delete(`/api/timekeeper/start-list/${entryId}`);
      setStartList(prev => prev.filter(e => e.id !== entryId));
      setMessage({ type: 'info', text: `${name} odebrán/a ze startovní listiny` });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se odebrat závodníka' });
    }
  };

  // --- Manual add ---
  const searchRacers = async (query) => {
    setRacerSearch(query);
    if (query.length < 2) { setRacerResults([]); return; }
    try {
      setSearchingRacers(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/racers/search?q=${encodeURIComponent(query)}`);
      setRacerResults(data);
    } catch (err) {
      setRacerResults([]);
    } finally {
      setSearchingRacers(false);
    }
  };

  const selectRacer = (racer) => {
    setAddForm(prev => ({
      ...prev,
      racer_id: racer.id,
      name_override: '',
      surname_override: '',
      year_override: '',
    }));
    setRacerSearch(`${racer.surname} ${racer.name} (${racer.year})`);
    setRacerResults([]);
  };

  const addManualEntry = async () => {
    if (!addForm.racer_id || !selectedRaceId) return;
    try {
      const body = { racer_id: parseInt(addForm.racer_id) };
      if (addForm.category_id) body.category_id = parseInt(addForm.category_id);
      if (addForm.start_number) body.start_number = parseInt(addForm.start_number);
      if (addForm.name_override && addForm.name_override.trim()) body.name_override = addForm.name_override.trim();
      if (addForm.surname_override && addForm.surname_override.trim()) body.surname_override = addForm.surname_override.trim();
      if (addForm.year_override) body.year_override = parseInt(addForm.year_override);

      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/entry`, body
      );
      setMessage({ type: 'success', text: result.message });
      setShowAddForm(false);
      setAddForm({ racer_id: '', category_id: '', start_number: '', name_override: '', surname_override: '', year_override: '' });
      setRacerSearch('');
      loadStartList();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se přidat závodníka' });
    }
  };

  // --- Drag & drop ---
  const handleDragStart = (index) => { dragItem.current = index; };
  const handleDragEnter = (index) => { dragOverItem.current = index; };
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
    const n = [...categoryOrder];
    [n[index - 1], n[index]] = [n[index], n[index - 1]];
    setCategoryOrder(n);
  };
  const moveCategoryDown = (index) => {
    if (index === categoryOrder.length - 1) return;
    const n = [...categoryOrder];
    [n[index], n[index + 1]] = [n[index + 1], n[index]];
    setCategoryOrder(n);
  };

  const getCategoryById = (id) => categories.find(c => c.id === id);
  const selectedRace = races.find(r => String(r.id) === String(selectedRaceId));

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Group by category — use array to preserve start_number order
  const groupedByCategory = (() => {
    const groups = [];
    const indexMap = new Map();
    for (const entry of startList) {
      const catKey = entry.category_id || 'none';
      if (!indexMap.has(catKey)) {
        indexMap.set(catKey, groups.length);
        groups.push({ key: catKey, name: entry.category_name || 'Bez kategorie', entries: [] });
      }
      groups[indexMap.get(catKey)].entries.push(entry);
    }
    return groups;
  })();

  // All active categories for category selects
  const allCategories = categories.length > 0 ? categories :
    [...new Map(startList.filter(e => e.category_id).map(e => [e.category_id, { id: e.category_id, name: e.category_name }])).values()];

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-list-ol me-2" style={{ color: '#e94560' }}></i>
            Startovní listina
          </h5>
          <small className="text-muted">Generování a správa startovní listiny</small>
        </div>
      </div>

      {/* Race selector */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px' }}>
        <div className="card-body py-2 px-3">
          <div className="row align-items-center g-2">
            <div className="col-md-5">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-trophy" style={{ color: '#e94560' }}></i>
                <select
                  className="form-select form-select-sm"
                  value={selectedRaceId}
                  onChange={(e) => { setSelectedRaceId(e.target.value); setShowGenerateSetup(false); setEditingId(null); }}
                  style={{ borderRadius: '8px' }}
                >
                  <option value="">-- Vyberte závod --</option>
                  {races.map(race => (
                    <option key={race.id} value={race.id}>
                      {race.raceNr || `#${race.id}`} — {race.areal_name || '?'} ({formatDate(race.datum)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedRace && (
              <div className="col-md-7">
                <div className="d-flex gap-2 justify-content-end flex-wrap">
                  <button
                    className="btn btn-sm text-white"
                    style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
                    onClick={showGenerateSetup ? () => setShowGenerateSetup(false) : openGenerateSetup}
                    disabled={generating}
                  >
                    <i className={`bi ${showGenerateSetup ? 'bi-x-lg' : 'bi-plus-circle'} me-1`}></i>
                    {showGenerateSetup ? 'Zrušit' : 'Generovat'}
                  </button>
                  {startList.length > 0 && (
                    <>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        style={{ borderRadius: '8px' }}
                        onClick={() => { setShowAddForm(!showAddForm); loadCategoriesIfNeeded(); }}
                      >
                        <i className="bi bi-person-plus me-1"></i>Přidat ručně
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        style={{ borderRadius: '8px' }}
                        onClick={clearStartList}
                      >
                        <i className="bi bi-trash me-1"></i>Smazat vše
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation setup panel */}
      {showGenerateSetup && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px', borderTop: '3px solid #e94560' }}>
          <div className="card-body py-3 px-3">
            {loadingSetup ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
                <small className="text-muted ms-2">Načítám nastavení...</small>
              </div>
            ) : (
              <>
                <h6 className="fw-bold mb-2">
                  <i className="bi bi-gear me-2"></i>Nastavení generování
                </h6>
                <div className="row g-3">
                  {/* Category ordering */}
                  <div className="col-12">
                    <div className="p-2 rounded-2" style={{ background: '#f8f9fa' }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="fw-bold">
                          <i className="bi bi-arrow-down-up me-1" style={{ color: '#e94560' }}></i>Pořadí kategorií
                        </small>
                        <small className="text-muted"><i className="bi bi-grip-vertical me-1"></i>Přetáhněte</small>
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {categoryOrder.map((catId, index) => {
                          const cat = getCategoryById(catId);
                          if (!cat) return null;
                          return (
                            <div key={catId} draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragEnter={() => handleDragEnter(index)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              className="d-flex align-items-center py-1 px-2 rounded-2"
                              style={{ background: 'white', border: '1px solid #dee2e6', cursor: 'grab', userSelect: 'none', fontSize: '0.85rem' }}
                            >
                              <i className="bi bi-grip-vertical text-muted me-2"></i>
                              <span className="badge me-2" style={{ background: '#e94560', minWidth: '22px', fontSize: '0.7rem' }}>{index + 1}</span>
                              <span className="fw-semibold flex-grow-1">{cat.name}</span>
                              <small className="text-muted me-2">{cat.sex === 2 ? '♀' : '♂'}</small>
                              <div className="btn-group btn-group-sm">
                                <button className="btn btn-outline-secondary py-0 px-1" style={{ fontSize: '0.7rem' }}
                                  onClick={(e) => { e.stopPropagation(); moveCategoryUp(index); }} disabled={index === 0}>
                                  <i className="bi bi-chevron-up"></i>
                                </button>
                                <button className="btn btn-outline-secondary py-0 px-1" style={{ fontSize: '0.7rem' }}
                                  onClick={(e) => { e.stopPropagation(); moveCategoryDown(index); }} disabled={index === categoryOrder.length - 1}>
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

                <div className="mt-3 d-flex justify-content-end">
                  <button className="btn btn-sm text-white px-3"
                    style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
                    onClick={generateStartList}
                    disabled={generating}>
                    {generating ? (
                      <><span className="spinner-border spinner-border-sm me-1"></span>Generuji...</>
                    ) : (
                      <><i className="bi bi-lightning me-1"></i>Vygenerovat</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manual add form */}
      {showAddForm && selectedRaceId && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px', borderTop: '3px solid #0d6efd' }}>
          <div className="card-body py-3 px-3">
            <h6 className="fw-bold mb-2">
              <i className="bi bi-person-plus me-2" style={{ color: '#0d6efd' }}></i>Přidat závodníka ručně
            </h6>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label small mb-1">Vyhledat závodníka *</label>
                <div className="position-relative">
                  <input type="text" className="form-control form-control-sm"
                    placeholder="Jméno / příjmení..." value={racerSearch}
                    onChange={(e) => searchRacers(e.target.value)}
                    style={{ borderRadius: '8px' }}
                  />
                  {searchingRacers && (
                    <div className="position-absolute end-0 top-50 translate-middle-y me-2">
                      <span className="spinner-border spinner-border-sm"></span>
                    </div>
                  )}
                  {racerResults.length > 0 && (
                    <div className="position-absolute w-100 mt-1 border rounded-2 bg-white shadow-sm" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                      {racerResults.map(r => (
                        <button key={r.id} className="btn btn-sm w-100 text-start border-0 py-1 px-2"
                          style={{ fontSize: '0.85rem' }}
                          onClick={() => selectRacer(r)}>
                          <strong>{r.surname} {r.name}</strong>
                          <small className="text-muted ms-1">({r.year}) {r.club_name || ''}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Kategorie</label>
                <select className="form-select form-select-sm" style={{ borderRadius: '8px' }}
                  value={addForm.category_id} onChange={(e) => setAddForm(p => ({ ...p, category_id: e.target.value }))}>
                  <option value="">—</option>
                  {allCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-1">St.č.</label>
                <input type="number" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                  placeholder="Auto" value={addForm.start_number}
                  onChange={(e) => setAddForm(p => ({ ...p, start_number: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-1">Přepis jména <small className="text-muted">(volitelné)</small></label>
                <div className="d-flex gap-1">
                  <input type="text" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                    placeholder="Jméno" value={addForm.name_override}
                    onChange={(e) => setAddForm(p => ({ ...p, name_override: e.target.value }))}
                  />
                  <input type="text" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                    placeholder="Příjmení" value={addForm.surname_override}
                    onChange={(e) => setAddForm(p => ({ ...p, surname_override: e.target.value }))}
                  />
                </div>
              </div>
              <div className="col-md-2 d-flex align-items-end gap-1">
                <button className="btn btn-sm btn-primary" style={{ borderRadius: '8px' }}
                  onClick={addManualEntry} disabled={!addForm.racer_id}>
                  <i className="bi bi-plus me-1"></i>Přidat
                </button>
                <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: '8px' }}
                  onClick={() => setShowAddForm(false)}>
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : message.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2`}></i>
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

      {/* Start list */}
      {!loading && selectedRaceId && startList.length > 0 && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="fw-semibold">
              Závodníků: <span style={{ color: '#e94560' }}>{startList.length}</span>
            </small>
            <button className="btn btn-sm btn-primary" style={{ borderRadius: '8px' }}
              onClick={() => navigate('/timekeeper/timing')}>
              <i className="bi bi-clock me-1"></i>Zadávání časů
            </button>
          </div>

          {groupedByCategory.map(group => (
            <div key={group.key} className="card border-0 shadow-sm mb-2" style={{ borderRadius: '10px' }}>
              <div className="card-header bg-white py-2 px-3 border-bottom" style={{ borderRadius: '10px 10px 0 0' }}>
                <small className="fw-bold">
                  <i className="bi bi-tag-fill me-1" style={{ color: '#e94560' }}></i>
                  {group.name}
                  <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>{group.entries.length}</span>
                </small>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.82rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '45px', padding: '4px 8px' }}>St.č.</th>
                        <th style={{ width: '55px', padding: '4px 8px' }}>Záv.č.</th>
                        <th style={{ padding: '4px 8px' }}>Závodník</th>
                        <th style={{ width: '55px', padding: '4px 8px' }}>Roč.</th>
                        <th style={{ padding: '4px 8px' }}>Klub</th>
                        <th style={{ width: '70px', padding: '4px 8px' }}>Čas 1</th>
                        <th style={{ width: '70px', padding: '4px 8px' }}>Čas 2</th>
                        <th style={{ width: '70px', padding: '4px 8px' }}>Součet</th>
                        <th style={{ width: '85px', padding: '4px 8px' }}>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map(entry => (
                        editingId === entry.id ? (
                          <tr key={entry.id} style={{ background: '#fffbea' }}>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="number" className="form-control form-control-sm"
                                style={{ width: '45px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.start_number}
                                onChange={(e) => setEditForm(p => ({ ...p, start_number: e.target.value }))}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              {entry.display_number ? <span className="badge bg-dark" style={{ fontSize: '0.7rem' }}>{entry.display_number}</span> : '—'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <div className="d-flex gap-1">
                                <input type="text" className="form-control form-control-sm"
                                  style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                  placeholder="Jméno (přepis)" value={editForm.name_override}
                                  onChange={(e) => setEditForm(p => ({ ...p, name_override: e.target.value }))}
                                />
                                <input type="text" className="form-control form-control-sm"
                                  style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                  placeholder="Příjmení (přepis)" value={editForm.surname_override}
                                  onChange={(e) => setEditForm(p => ({ ...p, surname_override: e.target.value }))}
                                />
                              </div>
                              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                Původní: {entry.racer_name} {entry.racer_surname}
                                {entry.has_override && <i className="bi bi-pencil-fill ms-1 text-warning" style={{ fontSize: '0.65rem' }}></i>}
                              </small>
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="number" className="form-control form-control-sm"
                                style={{ width: '55px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.year_override}
                                onChange={(e) => setEditForm(p => ({ ...p, year_override: e.target.value }))}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }} className="text-muted">{entry.club_name || '—'}</td>
                            <td colSpan="3" style={{ padding: '4px 8px' }}>
                              <select className="form-select form-select-sm" style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.category_id} onChange={(e) => setEditForm(p => ({ ...p, category_id: e.target.value }))}>
                                <option value="">Bez kat.</option>
                                {allCategories.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-success py-0 px-1" style={{ fontSize: '0.75rem' }}
                                  onClick={saveEditing} title="Uložit">
                                  <i className="bi bi-check-lg"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{ fontSize: '0.75rem' }}
                                  onClick={cancelEditing} title="Zrušit">
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={entry.id}>
                            <td className="fw-bold" style={{ padding: '4px 8px' }}>{entry.start_number || '—'}</td>
                            <td style={{ padding: '4px 8px' }}>
                              {entry.display_number ? <span className="badge bg-dark" style={{ fontSize: '0.7rem' }}>{entry.display_number}</span> : '—'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <span className="fw-semibold">{entry.racer_surname} {entry.racer_name}</span>
                              {entry.has_override && (
                                <i className="bi bi-pencil-fill ms-1 text-warning" style={{ fontSize: '0.65rem' }} title="Přepsané údaje"></i>
                              )}
                            </td>
                            <td style={{ padding: '4px 8px' }}>{entry.racer_year}</td>
                            <td className="text-muted" style={{ padding: '4px 8px' }}>{entry.club_name || '—'}</td>
                            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {(entry.dnf || entry.dns || entry.dsq) ? '—' : (entry.time1 != null ? entry.time1.toFixed(2) : '—')}
                            </td>
                            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {(entry.dnf || entry.dns || entry.dsq) ? '—' : (entry.time2 != null ? entry.time2.toFixed(2) : '—')}
                            </td>
                            <td className="fw-bold" style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {entry.dnf ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>DNF</span>
                                : entry.dns ? <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>DNS</span>
                                : entry.dsq ? <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>DSQ</span>
                                : (entry.time_sum != null ? entry.time_sum.toFixed(2) : '—')}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-outline-primary py-0 px-1" style={{ fontSize: '0.7rem' }}
                                  onClick={() => startEditing(entry)} title="Upravit">
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-danger py-0 px-1" style={{ fontSize: '0.7rem' }}
                                  onClick={() => deleteEntry(entry.id, `${entry.racer_surname} ${entry.racer_name}`)} title="Odebrat">
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
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
        <div className="text-center py-4">
          <i className="bi bi-list-ul text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 mb-0 small">Startovní listina je prázdná</p>
          <small className="text-muted">Klikněte na "Generovat" pro vytvoření listiny</small>
        </div>
      )}

      {!selectedRaceId && (
        <div className="text-center py-4">
          <i className="bi bi-hand-index text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Vyberte závod</p>
        </div>
      )}
    </div>
  );
}
