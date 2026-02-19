import React, { useState, useEffect } from 'react';
import { TimekeeperAPI } from '../../config/api.js';

export default function RaceNumbersManager() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    set_number: '',
    actual_from: '1',
    actual_to: '200',
    display_from: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSets();
  }, []);

  const loadSets = async () => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get('/api/timekeeper/race-number-sets');
      setSets(data);
      // Auto-calculate next set_number and display_from
      if (data.length > 0) {
        const maxSet = Math.max(...data.map(s => s.set_number));
        const maxDisplay = Math.max(...data.map(s => s.max_display));
        setFormData(prev => ({
          ...prev,
          set_number: String(maxSet + 1),
          display_from: String(maxDisplay + 1),
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          set_number: '1',
          display_from: '1',
        }));
      }
    } catch (err) {
      setMessage({ type: 'danger', text: 'Nepodařilo se načíst sady čísel' });
    } finally {
      setLoading(false);
    }
  };

  const createSet = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const result = await TimekeeperAPI.post('/api/timekeeper/race-number-sets', {
        set_number: parseInt(formData.set_number),
        actual_from: parseInt(formData.actual_from),
        actual_to: parseInt(formData.actual_to),
        display_from: parseInt(formData.display_from),
      });
      setMessage({ type: 'success', text: result.message });
      setShowForm(false);
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se vytvořit sadu' });
    } finally {
      setCreating(false);
    }
  };

  const deleteSet = async (setNumber) => {
    if (!window.confirm(`Opravdu smazat celou sadu č. ${setNumber}? Tato akce je nevratná.`)) return;
    try {
      const result = await TimekeeperAPI.delete(`/api/timekeeper/race-number-sets/${setNumber}`);
      setMessage({ type: 'success', text: result.message });
      loadSets();
    } catch (err) {
      setMessage({ type: 'danger', text: err.message || 'Nepodařilo se smazat sadu' });
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-123 me-2" style={{ color: '#e94560' }}></i>
            Startovní čísla
          </h3>
          <p className="text-muted mb-0">Správa sad startovních čísel pro přidělování závodníkům</p>
        </div>
        <button
          className="btn btn-lg text-white"
          style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '10px' }}
          onClick={() => setShowForm(!showForm)}
        >
          <i className={`bi ${showForm ? 'bi-x-lg' : 'bi-plus-circle'} me-2`}></i>
          {showForm ? 'Zrušit' : 'Nová sada'}
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className={`alert alert-${message.type} d-flex align-items-center`} role="alert">
          <i className={`bi ${message.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
          {message.text}
          <button type="button" className="btn-close ms-auto" onClick={() => setMessage(null)}></button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', borderTop: '3px solid #e94560' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">
              <i className="bi bi-plus-circle me-2"></i>
              Vytvořit novou sadu startovních čísel
            </h5>
            <form onSubmit={createSet}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Číslo sady</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.set_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, set_number: e.target.value }))}
                    min="1"
                    required
                    style={{ borderRadius: '10px' }}
                  />
                  <small className="text-muted">Identifikátor sady (1, 2, 3...)</small>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Reálná čísla od</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.actual_from}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_from: e.target.value }))}
                    min="1"
                    required
                    style={{ borderRadius: '10px' }}
                  />
                  <small className="text-muted">Číslo prvního dresu</small>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Reálná čísla do</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.actual_to}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_to: e.target.value }))}
                    min="1"
                    required
                    style={{ borderRadius: '10px' }}
                  />
                  <small className="text-muted">Číslo posledního dresu</small>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Zobrazení od</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.display_from}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_from: e.target.value }))}
                    min="1"
                    required
                    style={{ borderRadius: '10px' }}
                  />
                  <small className="text-muted">Startovní číslo v systému</small>
                </div>
              </div>
              
              {/* Preview */}
              {formData.actual_from && formData.actual_to && formData.display_from && (
                <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }}>
                  <small className="fw-semibold text-muted">
                    <i className="bi bi-eye me-1"></i> Náhled:
                  </small>
                  <span className="ms-2">
                    Dresy {formData.actual_from}–{formData.actual_to} budou v systému jako{' '}
                    <strong>{formData.display_from}–{parseInt(formData.display_from) + (parseInt(formData.actual_to) - parseInt(formData.actual_from))}</strong>
                    {' '}({parseInt(formData.actual_to) - parseInt(formData.actual_from) + 1} čísel)
                  </span>
                </div>
              )}

              <div className="mt-3">
                <button
                  type="submit"
                  className="btn text-white"
                  style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '10px' }}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Vytvářím...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-2"></i>
                      Vytvořit sadu
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sets list */}
      {sets.length > 0 ? (
        <div className="row g-3">
          {sets.map(set => (
            <div key={set.set_number} className="col-md-6 col-lg-4">
              <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '12px' }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <span className="badge fs-6" style={{ background: 'linear-gradient(135deg, #e94560, #c23152)' }}>
                        Sada {set.set_number}
                      </span>
                    </div>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => deleteSet(set.set_number)}
                      title="Smazat sadu"
                      style={{ borderRadius: '8px' }}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                  
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted small">Reálná čísla (dresy):</span>
                      <span className="fw-bold">{set.min_actual} – {set.max_actual}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted small">Zobrazení v systému:</span>
                      <span className="fw-bold">{set.min_display} – {set.max_display}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted small">Počet čísel:</span>
                      <span className="fw-bold">{set.count}</span>
                    </div>
                  </div>

                  <div className="progress" style={{ height: '6px', borderRadius: '3px' }}>
                    <div
                      className="progress-bar"
                      style={{ width: '100%', background: 'linear-gradient(135deg, #e94560, #c23152)' }}
                    ></div>
                  </div>
                </div>
              </div>
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

      {/* Info */}
      <div className="card border-0 bg-light mt-4" style={{ borderRadius: '12px' }}>
        <div className="card-body">
          <h6 className="fw-bold mb-2">
            <i className="bi bi-info-circle me-2 text-primary"></i>
            Jak fungují sady čísel?
          </h6>
          <ul className="text-muted small mb-0">
            <li>Každá sada odpovídá fyzickým dresům/číslům, které máte k dispozici</li>
            <li><strong>Sada 1:</strong> Dresy 1-200 → systém zobrazuje 1-200</li>
            <li><strong>Sada 2:</strong> Stejné dresy 1-200 → systém zobrazuje 201-400 (pro odlišení)</li>
            <li>Při generování startovní listiny zvolíte, kterou sadu použít</li>
            <li>Sadu nelze smazat, pokud jsou její čísla přiřazena na startovní listině</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
