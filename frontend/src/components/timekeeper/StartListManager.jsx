import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/api.js';

export default function StartListManager() {
  const emptyAddForm = {
    racer_id: '',
    start_number: '',
    racer_name: '',
    racer_surname: '',
    racer_year: '',
    racer_sex: '',
    racer_slcr_id: '',
    club_name: '',
    race_number_display: '',
  };

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
  const [editValidationError, setEditValidationError] = useState('');

  // Manual add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addMode, setAddMode] = useState('existing');
  const [racerSearch, setRacerSearch] = useState('');
  const [racerResults, setRacerResults] = useState([]);
  const [searchingRacers, setSearchingRacers] = useState(false);
  const [addValidationError, setAddValidationError] = useState('');
  const [raceNumberOptions, setRaceNumberOptions] = useState([]);

  // Drag & drop refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => { loadRaces(); }, []);

  useEffect(() => {
    if (selectedRaceId) {
      loadStartList();
      loadRaceNumberOptions();
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

  const loadRaceNumberOptions = async () => {
    try {
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-options');
      setRaceNumberOptions(data);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst seznam závodních čísel' });
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
      racer_name: entry.racer_name || '',
      racer_surname: entry.racer_surname || '',
      racer_year: entry.racer_year || '',
      racer_sex: entry.racer_sex || '',
      club_name: entry.club_name || '',
      race_number_display: entry.race_number_display || '',
    });
    setEditValidationError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
    setEditValidationError('');
  };

  const sortStartListEntries = (entries) => [...entries].sort((a, b) => {
    const aRank = a.category_rank ?? Number.MAX_SAFE_INTEGER;
    const bRank = b.category_rank ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    const aStart = a.start_number ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.start_number ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });

  const findRaceNumberOption = (displayNumber) => {
    if (displayNumber === '' || displayNumber === null || displayNumber === undefined) return null;
    return raceNumberOptions.find(option => String(option.display_number) === String(displayNumber)) || null;
  };

  const getRaceNumberValidationError = (displayNumber, excludeEntryId = null, currentEntry = null) => {
    if (displayNumber === '' || displayNumber === null || displayNumber === undefined) return '';

    const option = findRaceNumberOption(displayNumber);
    const isCurrentEntryNumber = currentEntry && currentEntry.race_number_display != null &&
      String(currentEntry.race_number_display) === String(displayNumber);

    if (!option && !isCurrentEntryNumber) {
      return `Systémové číslo ${displayNumber} neexistuje nebo je neaktivní`;
    }

    const conflict = startList.find(entry =>
      entry.id !== excludeEntryId &&
      entry.race_number_display != null &&
      String(entry.race_number_display) === String(displayNumber)
    );

    if (conflict) {
      return `Systémové číslo ${displayNumber} už má ${conflict.racer_surname} ${conflict.racer_name}`;
    }

    return '';
  };

  const resolveCategoryPreview = (year, sex) => {
    if (!year || !sex || categories.length === 0) return 'Kategorie se dopočítá při uložení';

    const parsedYear = parseInt(year);
    const parsedSex = parseInt(sex);
    if (Number.isNaN(parsedYear) || Number.isNaN(parsedSex)) return 'Kategorie se dopočítá při uložení';

    const match = categories.find(category =>
      category.min_birth_year <= parsedYear &&
      category.max_birth_year >= parsedYear &&
      (category.sex === 0 || category.sex === parsedSex)
    );

    if (!match) return 'Bez kategorie';
    return match.sex_label === 'Mix' ? match.name : `${match.name} - ${match.sex_label}`;
  };

  const saveEditing = async () => {
    if (!editingId) return;
    const currentEntry = startList.find(entry => entry.id === editingId) || null;

    const raceNumberError = getRaceNumberValidationError(editForm.race_number_display, editingId, currentEntry);
    if (raceNumberError) {
      setEditValidationError(raceNumberError);
      return;
    }

    try {
      const body = {};
      if (editForm.start_number !== '') body.start_number = parseInt(editForm.start_number);
      body.racer_name = editForm.racer_name?.trim() || null;
      body.racer_surname = editForm.racer_surname?.trim() || null;
      body.club_name = editForm.club_name?.trim() || null;
      body.racer_year = editForm.racer_year !== '' && editForm.racer_year !== null && editForm.racer_year !== undefined
        ? parseInt(editForm.racer_year)
        : null;
      body.race_number_display = editForm.race_number_display !== '' ? parseInt(editForm.race_number_display) : null;

      const result = await TimekeeperAPI.put(`/api/timekeeper/start-list/${editingId}`, body);
      setStartList(prev => sortStartListEntries(prev.map(entry => (
        entry.id === editingId ? result.entry : entry
      ))));
      setEditingId(null);
      setEditForm({});
      setEditValidationError('');
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
      racer_id: racer.id,
      start_number: prev.start_number,
      racer_name: racer.name || '',
      racer_surname: racer.surname || '',
      racer_year: racer.year || '',
      racer_sex: racer.sex || '',
      racer_slcr_id: racer.slcr_id || '',
      club_name: racer.club_name || '',
      race_number_display: prev.race_number_display,
    }));
    setRacerSearch(`${racer.surname} ${racer.name} (${racer.year})`);
    setRacerResults([]);
    setAddValidationError('');
  };

  const resetAddForm = () => {
    setAddForm(emptyAddForm);
    setRacerSearch('');
    setRacerResults([]);
    setAddValidationError('');
  };

  const addManualEntry = async () => {
    if (!selectedRaceId) return;

    if (addMode === 'existing' && !addForm.racer_id) {
      setAddValidationError('Nejprve vyberte existujícího závodníka');
      return;
    }

    if (addMode === 'new' && (!addForm.racer_name.trim() || !addForm.racer_surname.trim() || !addForm.racer_year || !addForm.racer_sex || !addForm.club_name.trim())) {
      setAddValidationError('Pro nového závodníka vyplňte jméno, příjmení, rok narození, pohlaví a oddíl');
      return;
    }

    const raceNumberError = getRaceNumberValidationError(addForm.race_number_display);
    if (raceNumberError) {
      setAddValidationError(raceNumberError);
      return;
    }

    try {
      const body = {};
      if (addMode === 'existing' && addForm.racer_id) body.racer_id = parseInt(addForm.racer_id);
      if (addForm.start_number) body.start_number = parseInt(addForm.start_number);
      if (addForm.racer_name && addForm.racer_name.trim()) body.racer_name = addForm.racer_name.trim();
      if (addForm.racer_surname && addForm.racer_surname.trim()) body.racer_surname = addForm.racer_surname.trim();
      if (addForm.racer_year) body.racer_year = parseInt(addForm.racer_year);
      if (addForm.racer_sex) body.racer_sex = parseInt(addForm.racer_sex);
      if (addForm.racer_slcr_id && addForm.racer_slcr_id.trim()) body.racer_slcr_id = addForm.racer_slcr_id.trim();
      if (addForm.club_name && addForm.club_name.trim()) body.club_name = addForm.club_name.trim();
      if (addForm.race_number_display) body.race_number_display = parseInt(addForm.race_number_display);

      const result = await TimekeeperAPI.post(
        `/api/timekeeper/races/${selectedRaceId}/start-list/entry`, body
      );
      setMessage({ type: 'success', text: result.message });
      setShowAddForm(false);
      setStartList(prev => sortStartListEntries([...prev, result.entry]));
      resetAddForm();
    } catch (err) {
      setAddValidationError(err.message || 'Nepodařilo se přidat závodníka');
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
    for (const entry of sortStartListEntries(startList)) {
      const catKey = entry.category_id || 'none';
      if (!indexMap.has(catKey)) {
        indexMap.set(catKey, groups.length);
        groups.push({
          key: catKey,
          name: entry.category_name || 'Bez kategorie',
          rank: entry.category_rank ?? Number.MAX_SAFE_INTEGER,
          entries: [],
        });
      }
      groups[indexMap.get(catKey)].entries.push(entry);
    }
    return groups.sort((a, b) => a.rank - b.rank);
  })();

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
                        onClick={() => {
                          const next = !showAddForm;
                          setShowAddForm(next);
                          if (next) {
                            resetAddForm();
                            setAddMode('existing');
                            loadCategoriesIfNeeded();
                          }
                        }}
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
            <div className="btn-group btn-group-sm mb-3">
              <button
                className={`btn ${addMode === 'existing' ? 'btn-primary' : 'btn-outline-primary'}`}
                style={{ borderRadius: addMode === 'existing' ? '8px 0 0 8px' : '8px 0 0 8px' }}
                onClick={() => { setAddMode('existing'); resetAddForm(); }}
              >
                Existující závodník
              </button>
              <button
                className={`btn ${addMode === 'new' ? 'btn-primary' : 'btn-outline-primary'}`}
                style={{ borderRadius: addMode === 'new' ? '0 8px 8px 0' : '0 8px 8px 0' }}
                onClick={() => { setAddMode('new'); resetAddForm(); }}
              >
                Nový závodník
              </button>
            </div>
            <div className="row g-2">
              {addMode === 'existing' && (
                <div className="col-md-3">
                  <label className="form-label small mb-1">Vyhledat závodníka *</label>
                  <div className="position-relative">
                    <input type="text" className="form-control form-control-sm"
                      placeholder="Jméno / příjmení / SLČR..." value={racerSearch}
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
                            <small className="text-muted d-block">({r.year}) {r.club_name || 'Bez oddílu'}{r.slcr_id ? ` • SLČR ${r.slcr_id}` : ''}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="col-md-2">
                <label className="form-label small mb-1">Systémové č.</label>
                <input type="number" className={`form-control form-control-sm ${addValidationError ? 'is-invalid' : ''}`} style={{ borderRadius: '8px' }}
                  value={addForm.race_number_display}
                  onChange={(e) => { setAddForm(p => ({ ...p, race_number_display: e.target.value })); setAddValidationError(''); }}
                  placeholder="Např. 201"
                />
                {addValidationError && (
                  <div className="invalid-feedback d-block">{addValidationError}</div>
                )}
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-1">St.č.</label>
                <input type="number" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                  placeholder="Auto" value={addForm.start_number}
                  onChange={(e) => setAddForm(p => ({ ...p, start_number: e.target.value }))}
                />
              </div>
              <div className={`${addMode === 'existing' ? 'col-md-3' : 'col-md-3'}`}>
                <label className="form-label small mb-1">Snapshot jména</label>
                <div className="d-flex gap-1">
                  <input type="text" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                    placeholder="Jméno" value={addForm.racer_name}
                    onChange={(e) => { setAddForm(p => ({ ...p, racer_name: e.target.value })); setAddValidationError(''); }}
                  />
                  <input type="text" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                    placeholder="Příjmení" value={addForm.racer_surname}
                    onChange={(e) => { setAddForm(p => ({ ...p, racer_surname: e.target.value })); setAddValidationError(''); }}
                  />
                </div>
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-1">Roč.</label>
                <input type="number" className="form-control form-control-sm" style={{ borderRadius: '8px' }}
                  value={addForm.racer_year}
                  onChange={(e) => { setAddForm(p => ({ ...p, racer_year: e.target.value })); setAddValidationError(''); }}
                />
              </div>
              <div className="col-md-1">
                <label className="form-label small mb-1">Pohlaví</label>
                <select
                  className="form-select form-select-sm"
                  style={{ borderRadius: '8px' }}
                  value={addForm.racer_sex}
                  onChange={(e) => { setAddForm(p => ({ ...p, racer_sex: e.target.value })); setAddValidationError(''); }}
                >
                  <option value="">-</option>
                  <option value="1">M</option>
                  <option value="2">Ž</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">Oddíl</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  style={{ borderRadius: '8px' }}
                  value={addForm.club_name}
                  onChange={(e) => { setAddForm(p => ({ ...p, club_name: e.target.value })); setAddValidationError(''); }}
                  placeholder="Např. SKI klub"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-1">SLČR ID</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  style={{ borderRadius: '8px' }}
                  value={addForm.racer_slcr_id}
                  onChange={(e) => setAddForm(p => ({ ...p, racer_slcr_id: e.target.value }))}
                  placeholder="Volitelné"
                />
              </div>
              <div className="col-md-2 d-flex align-items-end gap-1">
                <button className="btn btn-sm btn-primary" style={{ borderRadius: '8px' }}
                  onClick={addManualEntry} disabled={addMode === 'existing' ? !addForm.racer_id : false}>
                  <i className="bi bi-plus me-1"></i>Přidat
                </button>
                <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: '8px' }}
                  onClick={() => { setShowAddForm(false); resetAddForm(); }}>
                  Zrušit
                </button>
              </div>
            </div>
            {addValidationError && (
              <div className="alert alert-danger py-2 small mt-3 mb-0">
                {addValidationError}
              </div>
            )}
            <div className="mt-2 d-flex flex-wrap gap-3 small text-muted">
              <span>Kategorie: <strong>{resolveCategoryPreview(addForm.racer_year, addForm.racer_sex)}</strong></span>
              <span>
                Dresové č.: <strong>{findRaceNumberOption(addForm.race_number_display)?.actual_number ?? '—'}</strong>
              </span>
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
                        <th style={{ width: '95px', padding: '4px 8px' }}>Čísla</th>
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
                              <input type="number" className={`form-control form-control-sm ${editValidationError ? 'is-invalid' : ''}`}
                                style={{ width: '78px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.race_number_display}
                                onChange={(e) => { setEditForm(p => ({ ...p, race_number_display: e.target.value })); setEditValidationError(''); }}
                                placeholder="Syst."
                              />
                              <small className="text-muted d-block mt-1">
                                Dres: {findRaceNumberOption(editForm.race_number_display)?.actual_number ?? entry.race_number_actual ?? '—'}
                              </small>
                              {editValidationError && (
                                <div className="invalid-feedback d-block">{editValidationError}</div>
                              )}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <div className="d-flex gap-1">
                                <input type="text" className="form-control form-control-sm"
                                  style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                  placeholder="Jméno" value={editForm.racer_name}
                                  onChange={(e) => setEditForm(p => ({ ...p, racer_name: e.target.value }))}
                                />
                                <input type="text" className="form-control form-control-sm"
                                  style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                  placeholder="Příjmení" value={editForm.racer_surname}
                                  onChange={(e) => setEditForm(p => ({ ...p, racer_surname: e.target.value }))}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="number" className="form-control form-control-sm"
                                style={{ width: '55px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.racer_year}
                                onChange={(e) => setEditForm(p => ({ ...p, racer_year: e.target.value }))}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input type="text" className="form-control form-control-sm"
                                style={{ fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.club_name}
                                onChange={(e) => setEditForm(p => ({ ...p, club_name: e.target.value }))}
                                placeholder="Klub"
                              />
                            </td>
                            <td colSpan="3" style={{ padding: '4px 8px' }}>
                              <div className="small text-muted">
                                Kategorie po uložení: <strong>{resolveCategoryPreview(editForm.racer_year, editForm.racer_sex)}</strong>
                              </div>
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
                              {entry.race_number_display ? (
                                <>
                                  <span className="badge bg-dark" style={{ fontSize: '0.7rem' }}>{entry.race_number_display}</span>
                                  <small className="text-muted d-block mt-1">Dres {entry.race_number_actual || '—'}</small>
                                </>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <span className="fw-semibold">{entry.racer_surname} {entry.racer_name}</span>
                              <small className="text-muted ms-1">| {entry.category_name || 'Bez kategorie'}</small>
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
