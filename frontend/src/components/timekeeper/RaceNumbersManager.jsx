import { useState, useEffect } from 'react';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { SET_COLOR_OPTIONS, getSetColorTheme } from '../../utils/raceNumbers.js';
import { TK_ACCENT, TK_ACCENT_GRADIENT } from './TimekeeperChrome.jsx';
import Icon from '../ms/Icon/Icon.jsx';

export default function RaceNumbersManager() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showSetForm, setShowSetForm] = useState(false);
  const [setFormData, setSetFormData] = useState({
    set_number: '', actual_from: '1', actual_to: '200', display_from: '', set_color: 'rose',
  });
  const [creating, setCreating] = useState(false);

  // Detail view
  const [expandedSet, setExpandedSet] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [updatingNumberId, setUpdatingNumberId] = useState(null);

  // Add single number form
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [addNumberData, setAddNumberData] = useState({
    actual_number: '', display_number: '',
  });

  useEffect(() => { loadSets(); }, []);

  const loadSets = async () => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-sets');
      setSets(data);
      if (data.length > 0) {
        const maxSet = Math.max(...data.map(s => s.set_number));
        const maxDisplay = Math.max(...data.map(s => s.max_display));
        setSetFormData(prev => ({ ...prev, set_number: String(maxSet + 1), display_from: String(maxDisplay + 1) }));
      } else {
        setSetFormData(prev => ({ ...prev, set_number: '1', display_from: '1' }));
      }
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst sady čísel' });
    } finally {
      setLoading(false);
    }
  };

  const loadNumbers = async (setNumber) => {
    try {
      setLoadingNumbers(true);
      const data = await TimekeeperAPI.get(`/api/timekeeper/race-numbers?set_number=${setNumber}`);
      setNumbers(data);
    } catch {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst čísla' });
    } finally {
      setLoadingNumbers(false);
    }
  };

  const toggleExpand = (setNumber) => {
    if (expandedSet === setNumber) {
      setExpandedSet(null);
      setNumbers([]);
      setShowAddNumber(false);
    } else {
      setExpandedSet(setNumber);
      loadNumbers(setNumber);
      setShowAddNumber(false);
      const set = sets.find(s => s.set_number === setNumber);
      if (set) {
        setAddNumberData({
          actual_number: String(set.max_actual + 1),
          display_number: String(set.max_display + 1),
        });
      }
    }
  };

  const createSet = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const result = await TimekeeperAPI.post('/api/timekeeper/race-number-sets', {
        set_number: parseInt(setFormData.set_number),
        actual_from: parseInt(setFormData.actual_from),
        actual_to: parseInt(setFormData.actual_to),
        display_from: parseInt(setFormData.display_from),
        set_color: setFormData.set_color,
      });
      setMessage({ type: 'success', text: result.message });
      setShowSetForm(false);
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se vytvořit sadu' });
    } finally {
      setCreating(false);
    }
  };

  const updateSetColor = async (setNumber, setColor) => {
    const previousSet = sets.find(set => set.set_number === setNumber);
    const previousColor = previousSet?.set_color || 'rose';
    if (previousColor === setColor) return;

    setSets(prev => prev.map(set => (
      set.set_number === setNumber ? { ...set, set_color: setColor } : set
    )));
    if (expandedSet === setNumber) {
      setNumbers(prev => prev.map(number => ({ ...number, set_color: setColor })));
    }

    try {
      await TimekeeperAPI.put(`/api/timekeeper/race-number-sets/${setNumber}`, { set_color: setColor });
    } catch (err) {
      setSets(prev => prev.map(set => (
        set.set_number === setNumber ? { ...set, set_color: previousColor } : set
      )));
      if (expandedSet === setNumber) {
        setNumbers(prev => prev.map(number => ({ ...number, set_color: previousColor })));
      }
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se změnit barvu sady' });
    }
  };

  const deleteSet = async (setNumber) => {
    if (!window.confirm(`Opravdu smazat celou sadu č. ${setNumber}?`)) return;
    try {
      const result = await TimekeeperAPI.delete(`/api/timekeeper/race-number-sets/${setNumber}`);
      setMessage({ type: 'success', text: result.message });
      if (expandedSet === setNumber) { setExpandedSet(null); setNumbers([]); }
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nelze smazat sadu' });
    }
  };

  const addNumber = async (e) => {
    e.preventDefault();
    try {
      const result = await TimekeeperAPI.post('/api/timekeeper/race-numbers', {
        set_number: expandedSet,
        actual_number: parseInt(addNumberData.actual_number),
        display_number: parseInt(addNumberData.display_number),
      });
      setMessage({ type: 'success', text: result.message });
      loadNumbers(expandedSet);
      loadSets();
      setAddNumberData({
        actual_number: String(parseInt(addNumberData.actual_number) + 1),
        display_number: String(parseInt(addNumberData.display_number) + 1),
      });
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nelze přidat číslo' });
    }
  };

  const updateSetSummaryCounts = (setNumber, nextIsActive, previousIsActive) => {
    if (nextIsActive === previousIsActive) return;

    setSets(prev => prev.map(set => {
      if (set.set_number !== setNumber) return set;

      const activeCount = typeof set.active_count === 'number' ? set.active_count : set.count;
      const inactiveCount = typeof set.inactive_count === 'number' ? set.inactive_count : Math.max(0, set.count - activeCount);

      return {
        ...set,
        active_count: activeCount + (nextIsActive ? 1 : -1),
        inactive_count: inactiveCount + (nextIsActive ? -1 : 1),
      };
    }));
  };

  const toggleNumberActive = async (numberId, isActive) => {
    const currentNumber = numbers.find(number => number.id === numberId);
    if (!currentNumber || currentNumber.is_active === isActive) return;

    try {
      setUpdatingNumberId(numberId);
      setNumbers(prev => prev.map(number => (
        number.id === numberId
          ? { ...number, is_active: isActive }
          : number
      )));
      updateSetSummaryCounts(currentNumber.set_number, isActive, currentNumber.is_active);

      await TimekeeperAPI.put(`/api/timekeeper/race-numbers/${numberId}`, {
        is_active: isActive,
      });
    } catch (err) {
      setNumbers(prev => prev.map(number => (
        number.id === numberId
          ? { ...number, is_active: currentNumber.is_active }
          : number
      )));
      updateSetSummaryCounts(currentNumber.set_number, currentNumber.is_active, isActive);
      setMessage({ type: 'danger', text: err.message || 'Nelze změnit stav čísla' });
    } finally {
      setUpdatingNumberId(null);
    }
  };

  const numberColumns = [];
  for (let i = 0; i < numbers.length; i += 10) {
    numberColumns.push(numbers.slice(i, i + 10));
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" style={{ color: TK_ACCENT }} role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="fw-bold mb-1" style={{ fontSize: '1.3rem' }}>
            <Icon name="numbers" className="me-2" style={{ color: TK_ACCENT }} />
            Startovní čísla
          </h3>
          <p className="text-muted mb-0 small">Správa sad startovních čísel</p>
        </div>
        <button className="btn text-white btn-sm"
          style={{ background: TK_ACCENT_GRADIENT, border: 'none', borderRadius: '8px' }}
          onClick={() => setShowSetForm(!showSetForm)}>
          <Icon name={showSetForm ? 'close' : 'plus-circle'} className="me-1" />
          {showSetForm ? 'Zrušit' : 'Nová sada'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
          <Icon name={message.type === 'success' ? 'success' : 'warning'} className="me-2" />
          {message.text}
          <button type="button" className="btn-close btn-close-sm ms-auto" onClick={() => setMessage(null)}></button>
        </div>
      )}

      {showSetForm && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px', borderTop: '3px solid #e94560' }}>
          <div className="card-body py-3">
            <h6 className="fw-bold mb-2"><Icon name="plus-circle" className="me-2" />Nová sada</h6>
            <form onSubmit={createSet}>
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Číslo sady</label>
                  <input type="number" className="form-control form-control-sm" value={setFormData.set_number}
                    onChange={(e) => setSetFormData(prev => ({ ...prev, set_number: e.target.value }))} min="1" required />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Reálná od</label>
                  <input type="number" className="form-control form-control-sm" value={setFormData.actual_from}
                    onChange={(e) => setSetFormData(prev => ({ ...prev, actual_from: e.target.value }))} min="1" required />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Reálná do</label>
                  <input type="number" className="form-control form-control-sm" value={setFormData.actual_to}
                    onChange={(e) => setSetFormData(prev => ({ ...prev, actual_to: e.target.value }))} min="1" required />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold mb-1">Zobrazení od</label>
                  <input type="number" className="form-control form-control-sm" value={setFormData.display_from}
                    onChange={(e) => setSetFormData(prev => ({ ...prev, display_from: e.target.value }))} min="1" required />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold mb-1">Barva sady</label>
                  <div className="d-flex flex-wrap gap-2">
                    {SET_COLOR_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={`btn btn-sm ${setFormData.set_color === option.value ? 'text-white' : 'btn-outline-secondary'}`}
                        onClick={() => setSetFormData(prev => ({ ...prev, set_color: option.value }))}
                        style={setFormData.set_color === option.value ? {
                          background: option.solid,
                          borderColor: option.solid,
                          borderRadius: '999px',
                        } : {
                          borderRadius: '999px',
                        }}
                      >
                        <span className="me-1 d-inline-block rounded-circle" style={{ width: '10px', height: '10px', background: option.solid }}></span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {setFormData.actual_from && setFormData.actual_to && setFormData.display_from && (
                <div className="mt-2 px-2 py-1 rounded small" style={{ background: '#f8f9fa' }}>
                  Dresy {setFormData.actual_from}–{setFormData.actual_to} → systém{' '}
                  <strong>{setFormData.display_from}–{parseInt(setFormData.display_from) + (parseInt(setFormData.actual_to) - parseInt(setFormData.actual_from))}</strong>
                  {' '}({parseInt(setFormData.actual_to) - parseInt(setFormData.actual_from) + 1} ks)
                </div>
              )}
              <div className="mt-2">
                <button type="submit" className="btn btn-sm text-white"
                  style={{ background: TK_ACCENT_GRADIENT, border: 'none', borderRadius: '8px' }}
                  disabled={creating}>
                  {creating ? <><span className="spinner-border spinner-border-sm me-1"></span>Vytvářím...</> : <><Icon name="check" className="me-1" />Vytvořit</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sets.length > 0 ? (
        <div className="d-flex flex-column gap-2">
          {sets.map(set => (
            <div key={set.set_number} className="card border-0 shadow-sm" style={{ borderRadius: '10px', borderTop: `3px solid ${getSetColorTheme(set.set_color).solid}` }}>
              <div className="card-body py-2 px-3 d-flex align-items-center justify-content-between"
                style={{ cursor: 'pointer' }} onClick={() => toggleExpand(set.set_number)}>
                <div className="d-flex align-items-center gap-3">
                  <Icon name={expandedSet === set.set_number ? 'chevron-down' : 'chevron-right'} className="text-muted" />
                  <span className="badge" style={{ background: getSetColorTheme(set.set_color).solid, fontSize: '0.8rem' }}>
                    Sada {set.set_number}
                  </span>
                  <span className="small">
                    <strong>{set.active_count ?? set.count}</strong> aktivních
                    <span className="text-muted ms-1">/ {set.count} celkem</span>
                    <span className="text-muted ms-2">
                      Dresy {set.min_actual}–{set.max_actual} → Systém {set.min_display}–{set.max_display}
                    </span>
                  </span>
                </div>
                <button className="btn btn-outline-danger btn-sm py-0 px-2"
                  onClick={(e) => { e.stopPropagation(); deleteSet(set.set_number); }} aria-label="Smazat celou sadu" title="Smazat celou sadu">
                  <Icon name="trash" style={{ fontSize: '0.75rem' }} />
                </button>
              </div>

              {expandedSet === set.set_number && (
                <div className="border-top">
                  <div className="d-flex align-items-center justify-content-between px-3 py-2" style={{ background: '#f8f9fa' }}>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <small className="text-muted">
                        {numbers.filter(n => n.is_active).length} aktivních, {numbers.filter(n => !n.is_active).length} neaktivních
                      </small>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <small className="text-muted">Barva:</small>
                        {SET_COLOR_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            title={option.label}
                            onClick={(e) => { e.stopPropagation(); updateSetColor(set.set_number, option.value); }}
                            className="btn btn-sm p-0 border"
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '999px',
                              background: option.solid,
                              borderColor: set.set_color === option.value ? '#212529' : 'rgba(0, 0, 0, 0.1)',
                              boxShadow: set.set_color === option.value ? '0 0 0 2px rgba(0,0,0,0.08)' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-outline-dark py-0 px-2"
                      onClick={() => setShowAddNumber(!showAddNumber)}>
                      <Icon name={showAddNumber ? 'close' : 'plus'} className="me-1" style={{ fontSize: '0.75rem' }} />
                      {showAddNumber ? 'Zrušit' : 'Přidat číslo'}
                    </button>
                  </div>

                  {showAddNumber && (
                    <div className="px-3 py-2 border-top" style={{ background: '#fff8f9' }}>
                      <form onSubmit={addNumber} className="d-flex align-items-end gap-2">
                        <div>
                          <label className="form-label small mb-0 fw-semibold">Reálné č.</label>
                          <input type="number" className="form-control form-control-sm" style={{ width: '100px' }}
                            value={addNumberData.actual_number}
                            onChange={(e) => setAddNumberData(prev => ({ ...prev, actual_number: e.target.value }))} min="1" required />
                        </div>
                        <div>
                          <label className="form-label small mb-0 fw-semibold">Zobrazení</label>
                          <input type="number" className="form-control form-control-sm" style={{ width: '100px' }}
                            value={addNumberData.display_number}
                            onChange={(e) => setAddNumberData(prev => ({ ...prev, display_number: e.target.value }))} min="1" required />
                        </div>
                        <button type="submit" className="btn btn-sm text-white" aria-label="Přidat číslo"
                          style={{ background: TK_ACCENT_GRADIENT, border: 'none', borderRadius: '6px' }}>
                          <Icon name="plus" />
                        </button>
                      </form>
                    </div>
                  )}

                  {loadingNumbers ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm" style={{ color: TK_ACCENT }}></div>
                    </div>
                  ) : (
                    <div className="px-3 py-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      <div className="timekeeper-race-number-grid">
                        {numberColumns.map((column, columnIndex) => (
                          <div key={columnIndex} className="timekeeper-race-number-column">
                            {column.length > 0 && (
                              <div className="timekeeper-race-number-column-header">
                                {column[0].display_number}-{column[column.length - 1].display_number}
                              </div>
                            )}
                            {column.map((n) => (
                              <button
                                key={n.id}
                                type="button"
                                className={`timekeeper-race-number-item ${n.is_active ? 'is-active' : 'is-inactive'}`}
                                title={`Číslo dresu ${n.actual_number} | Sys. ${n.display_number}`}
                                disabled={updatingNumberId === n.id}
                                onClick={() => toggleNumberActive(n.id, !n.is_active)}
                                style={{
                                  '--set-border': n.is_active ? getSetColorTheme(n.set_color).border : '#e9ecef',
                                  '--set-bg': n.is_active ? getSetColorTheme(n.set_color).soft : '#f8f9fa',
                                  '--set-solid': getSetColorTheme(n.set_color).solid,
                                }}
                              >
                                <span className="timekeeper-race-number-state" aria-hidden="true" style={{
                                  background: n.is_active ? getSetColorTheme(n.set_color).solid : '#adb5bd',
                                }}></span>
                                <span className="fw-semibold timekeeper-race-number-display">{n.actual_number}</span>
                                {n.actual_number !== n.display_number && (
                                  <span className="text-muted timekeeper-race-number-actual">({n.display_number})</span>
                                )}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-5">
          <Icon name="numbers" className="text-muted" style={{ fontSize: '3rem' }} />
          <p className="text-muted mt-3 mb-1">Žádné sady startovních čísel</p>
          <p className="text-muted small">Vytvořte první sadu kliknutím na "Nová sada"</p>
        </div>
      )}
    </div>
  );
}
