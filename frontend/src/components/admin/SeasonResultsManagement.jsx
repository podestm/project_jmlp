import { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth';
import API, { AdminAPI } from '../../config/api';
import Alert from '../ui/Alert';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function SeasonResultsManagement() {
  const [seasonResults, setSeasonResults] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    season_year_start: new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1,
    season_year_end: new Date().getMonth() >= 7 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
    document_id: '',
    final_results: 1
  });

  useEffect(() => {
    fetchSeasonResults();
    fetchDocuments();
  }, []);

  const fetchSeasonResults = async () => {
    try {
      setLoading(true);
      const data = await AdminAPI.get('/api/admin/season-results');
      setSeasonResults(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const data = await AdminAPI.get('/api/admin/files');
      setDocuments(data);
    } catch (err) {
      console.error('Chyba při načítání dokumentů:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const payload = editingId 
        ? { 
            document_id: parseInt(formData.document_id),
            final_results: parseInt(formData.final_results)
          }
        : {
            season_year_start: parseInt(formData.season_year_start),
            season_year_end: parseInt(formData.season_year_end),
            document_id: parseInt(formData.document_id),
            final_results: parseInt(formData.final_results)
          };

      if (editingId) {
        await AdminAPI.put(`/api/admin/season-results/${editingId}`, payload);
        setSuccess('Celkové výsledky byly aktualizovány');
      } else {
        await AdminAPI.post('/api/admin/season-results', payload);
        setSuccess('Celkové výsledky byly vytvořeny');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchSeasonResults();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (seasonResult) => {
    setEditingId(seasonResult.id);
    setFormData({
      season_year_start: seasonResult.season_year_start,
      season_year_end: seasonResult.season_year_end,
      document_id: seasonResult.document_id,
      final_results: seasonResult.final_results || 1
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (id, seasonYearStart, seasonYearEnd) => {
    if (!window.confirm(`Opravdu chcete smazat celkové výsledky pro sezónu ${seasonYearStart}/${seasonYearEnd}?`)) {
      return;
    }

    try {
      await AdminAPI.delete(`/api/admin/season-results/${id}`);
      setSuccess('Celkové výsledky byly úspěšně smazány');
      fetchSeasonResults();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      season_year_start: new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1,
      season_year_end: new Date().getMonth() >= 7 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
      document_id: '',
      final_results: 1
    });
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return <div className="text-center my-5">Načítání...</div>;
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Správa celkových výsledků sezón</h2>
        {!showForm && (
          <button 
            className="btn btn-success"
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              resetForm();
              setError(null);
              setSuccess(null);
            }}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Přidat celkové výsledky
          </button>
        )}
      </div>

      {error && <Alert type="danger" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              {editingId ? 'Upravit celkové výsledky' : 'Nové celkové výsledky'}
            </h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Počáteční rok sezóny *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.season_year_start}
                    onChange={(e) => setFormData({ ...formData, season_year_start: e.target.value })}
                    required
                    disabled={editingId !== null}
                    min="2000"
                    max="2100"
                  />
                  <small className="text-muted">Např. 2024 pro sezónu 2024/2025</small>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Koncový rok sezóny *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.season_year_end}
                    onChange={(e) => setFormData({ ...formData, season_year_end: e.target.value })}
                    required
                    disabled={editingId !== null}
                    min="2000"
                    max="2100"
                  />
                  <small className="text-muted">Např. 2025 pro sezónu 2024/2025</small>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Dokument *</label>
                  <select
                    className="form-select"
                    value={formData.document_id}
                    onChange={(e) => setFormData({ ...formData, document_id: e.target.value })}
                    required
                  >
                    <option value="">-- Vyberte dokument --</option>
                    {documents.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.original_filename}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">Vyberte nahrané celkové výsledky</small>
                </div>
              </div>

              <div className="row">
                <div className="col-md-12 mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="finalResultsCheck"
                      checked={formData.final_results === 1}
                      onChange={(e) => setFormData({ ...formData, final_results: e.target.checked ? 1 : 0 })}
                    />
                    <label className="form-check-label" htmlFor="finalResultsCheck">
                      Celkové výsledky (pokud není zaškrtnuto, jedná se o průběžné výsledky)
                    </label>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-check-circle me-2"></i>
                  {editingId ? 'Aktualizovat' : 'Vytvořit'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  <i className="bi bi-x-circle me-2"></i>
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Celkové výsledky sezón</h5>
        </div>
        <div className="card-body">
          {seasonResults.length === 0 ? (
            <p className="text-muted mb-0">Zatím nebyly přidány žádné celkové výsledky sezón.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Sezóna</th>
                    <th>Dokument</th>
                    <th>Vytvořeno</th>
                    <th>Aktualizováno</th>
                    <th className="text-end">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonResults.map(sr => (
                    <tr key={sr.id}>
                      <td>
                        <strong>{sr.season_year_start}/{sr.season_year_end}</strong>
                      </td>
                      <td>
                        <a 
                          href={`${API_BASE}${sr.document_file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-decoration-none"
                        >
                          <i className="bi bi-file-earmark-pdf me-2"></i>
                          {sr.document_original_filename}
                        </a>
                      </td>
                      <td>
                        {new Date(sr.created_at).toLocaleDateString('cs-CZ')}
                      </td>
                      <td>
                        {new Date(sr.updated_at).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => handleEdit(sr)}
                          title="Změnit dokument"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(sr.id, sr.season_year_start, sr.season_year_end)}
                          title="Smazat"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
