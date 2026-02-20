import React, { useState, useEffect } from 'react';
import { TimekeeperAPI } from '../../config/api.js';

export default function RaceNumbersManager() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showSetForm, setShowSetForm] = useState(false);
  const [setFormData, setSetFormData] = useState({
    set_number: '', actual_from: '1', actual_to: '200', display_from: '',
  });
  const [creating, setCreating] = useState(false);

  // Detail view
  const [expandedSet, setExpandedSet] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

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
    } catch (err) {
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
    } catch (err) {
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

  const deleteNumber = async (numberId, displayNum) => {
    if (!window.confirm(`Smazat číslo ${displayNum}?`)) return;
    try {
      const result = await TimekeeperAPI.delete(`/api/timekeeper/race-numbers/${numberId}`);
      setMessage({ type: 'success', text: result.message });
      loadNumbers(expandedSet);
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nelze smazat číslo' });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" style={{ color: '#e94560' }} role="status">
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
            <i className="bi bi-123 me-2" style={{ color: '#e94560' }}></i>
            Startovní čísla
          </h3>
          <p className="text-muted mb-0 small">Správa sad startovních čísel</p>
        </div>
        <button className="btn text-white btn-sm"
          style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
          onClick={() => setShowSetForm(!showSetForm)}>
          <i className={`bi ${showSetForm ? 'bi-x-lg' : 'bi-plus-circle'} me-1`}></i>
          {showSetForm ? 'Zrušit' : 'Nová sada'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type} py-2 d-flex align-items-center small`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close btn-close-sm ms-auto" onClick={() => setMessage(null)}></button>
        </div>
      )}

      {showSetForm && (
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '10px', borderTop: '3px solid #e94560' }}>
          <div className="card-body py-3">
            <h6 className="fw-bold mb-2"><i className="bi bi-plus-circle me-2"></i>Nová sada</h6>
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
                  style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
                  disabled={creating}>
                  {creating ? <><span className="spinner-border spinner-border-sm me-1"></span>Vytvářím...</> : <><i className="bi bi-check-lg me-1"></i>Vytvořit</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sets.length > 0 ? (
        <div className="d-flex flex-column gap-2">
          {sets.map(set => (
            <div key={set.set_number} className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
              <div className="card-body py-2 px-3 d-flex align-items-center justify-content-between"
                style={{ cursor: 'pointer' }} onClick={() => toggleExpand(set.set_number)}>
                <div className="d-flex align-items-center gap-3">
                  <i className={`bi ${expandedSet === set.set_number ? 'bi-chevron-down' : 'bi-chevron-right'} text-muted`}></i>
                  <span className="badge" style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', fontSize: '0.8rem' }}>
                    Sada {set.set_number}
                  </span>
                  <span className="small">
                    <strong>{set.count}</strong> čísel
                    <span className="text-muted ms-2">
                      Dresy {set.min_actual}–{set.max_actual} → Systém {set.min_display}–{set.max_display}
                    </span>
                  </span>
                </div>
                <button className="btn btn-outline-danger btn-sm py-0 px-2"
                  onClick={(e) => { e.stopPropagation(); deleteSet(set.set_number); }} title="Smazat celou sadu">
                  <i className="bi bi-trash" style={{ fontSize: '0.75rem' }}></i>
                </button>
              </div>

              {expandedSet === set.set_number && (
                <div className="border-top">
                  <div className="d-flex align-items-center justify-content-between px-3 py-2" style={{ background: '#f8f9fa' }}>
                    <small className="text-muted">{numbers.length} čísel v sadě</small>
                    <button className="btn btn-sm btn-outline-dark py-0 px-2"
                      onClick={() => setShowAddNumber(!showAddNumber)}>
                      <i className={`bi ${showAddNumber ? 'bi-x' : 'bi-plus'} me-1`} style={{ fontSize: '0.75rem' }}></i>
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
                        <button type="submit" className="btn btn-sm text-white"
                          style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '6px' }}>
                          <i className="bi bi-plus-lg"></i>
                        </button>
                      </form>
                    </div>
                  )}

                  {loadingNumbers ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
                    </div>
                  ) : (
                    <div className="px-3 py-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      <div className="d-flex flex-wrap gap-1">
                        {numbers.map(n => (
                          <div key={n.id}
                            className="d-inline-flex align-items-center border rounded px-2 py-0"
                            style={{ fontSize: '0.78rem', background: 'white' }}
                            title={`Dres ${n.actual_number} → ${n.display_number}`}>
                            <span className="fw-semibold me-1" style={{ minWidth: '28px' }}>{n.display_number}</span>
                            {n.actual_number !== n.display_number && (
                              <span className="text-muted me-1" style={{ fontSize: '0.65rem' }}>({n.actual_number})</span>
                            )}
                            <button className="btn btn-link p-0 text-danger"
                              onClick={() => deleteNumber(n.id, n.display_number)}
                              style={{ fontSize: '0.65rem', lineHeight: 1 }} title="Smazat">
                              <i className="bi bi-x-lg"></i>
                            </button>
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
          <i className="bi bi-123 text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3 mb-1">Žádné sady startovních čísel</p>
          <p className="text-muted small">Vytvořte první sadu kliknutím na "Nová sada"</p>
        </div>
      )}
    </div>
  );
}
