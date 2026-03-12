import React, { useState, useEffect, useRef } from 'react';
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
  const [editValidationError, setEditValidationError] = useState('');

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
      return `St. číslo ${displayNumber} neexistuje nebo je neaktivní`;
    }

    const conflict = startList.find(entry =>
      entry.id !== excludeEntryId &&
      entry.race_number_display != null &&
      String(entry.race_number_display) === String(displayNumber)
    );

    if (conflict) {
      return `St. číslo ${displayNumber} už má ${conflict.racer_surname} ${conflict.racer_name}`;
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
      await loadStartList();
      setMessage({ type: 'info', text: `${name} odebrán/a ze startovní listiny` });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se odebrat závodníka' });
    }
  };

  const currentEditingEntry = editingId
    ? startList.find(entry => entry.id === editingId) || null
    : null;
  const liveEditRaceNumberError = editingId
    ? getRaceNumberValidationError(editForm.race_number_display, editingId, currentEditingEntry)
    : '';

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
                <div className="form-control form-control-sm d-flex align-items-center" style={{ borderRadius: '8px', minHeight: '38px', background: '#fff' }}>
                  {selectedRace
                    ? `${selectedRace.raceNr || `#${selectedRace.id}`} — ${selectedRace.areal_name || '?'} (${formatDate(selectedRace.datum)})`
                    : 'Závod vyberte v Přehledu závodů'}
                </div>
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
                  <button
                    className="btn btn-sm btn-outline-primary"
                    style={{ borderRadius: '8px' }}
                    onClick={() => navigate('/timekeeper/racers')}
                  >
                    <i className="bi bi-people me-1"></i>Závodníci
                  </button>
                  {startList.length > 0 && (
                    <>
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
                        <th style={{ width: '85px', padding: '4px 8px' }}>Pořadí</th>
                        <th style={{ width: '125px', padding: '4px 8px' }}>St. číslo</th>
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
                              <input type="number" className={`form-control form-control-sm ${(liveEditRaceNumberError || editValidationError) ? 'is-invalid' : ''}`}
                                style={{ width: '78px', fontSize: '0.8rem', padding: '2px 4px' }}
                                value={editForm.race_number_display}
                                onChange={(e) => { setEditForm(p => ({ ...p, race_number_display: e.target.value })); setEditValidationError(''); }}
                                placeholder="St. číslo"
                              />
                              <small className="text-muted d-block mt-1">
                                Číslo dresu: {findRaceNumberOption(editForm.race_number_display)?.actual_number ?? entry.race_number_actual ?? '—'}
                              </small>
                              {(liveEditRaceNumberError || editValidationError) && (
                                <div className="invalid-feedback d-block">{liveEditRaceNumberError || editValidationError}</div>
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
                                  <small className="text-muted d-block mt-1">Číslo dresu: {entry.race_number_actual || '—'}</small>
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
