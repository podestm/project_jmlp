import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';

export default function CategoryManagement() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [coverageReport, setCoverageReport] = useState(null);
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    min_birth_year: new Date().getFullYear() - 50,
    max_birth_year: new Date().getFullYear() - 18,
    active: true
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await AdminAPI.get('/admin/categories');
      setCategories(data);
      setError(null);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Nepodařilo se načíst kategorie');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validace
    if (parseInt(formData.min_birth_year) > parseInt(formData.max_birth_year)) {
      setError('Nejstarší ročník musí být menší nebo roven nejmladšímu ročníku');
      return;
    }

    try {
      if (editingCategory) {
        await AdminAPI.put(`/admin/categories/${editingCategory.id}`, formData);
        setSuccess('Kategorie úspěšně upravena');
      } else {
        await AdminAPI.post('/admin/categories', formData);
        setSuccess('Kategorie úspěšně vytvořena');
      }
      
      resetForm();
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err.message || 'Nepodařilo se uložit kategorii');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      min_birth_year: category.min_birth_year,
      max_birth_year: category.max_birth_year,
      active: category.active
    });
    setShowForm(true);
    setError(null);
    setSuccess('');
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Opravdu chcete smazat tuto kategorii?')) {
      return;
    }

    try {
      await AdminAPI.delete(`/admin/categories/${categoryId}`);
      setSuccess('Kategorie úspěšně smazána');
      loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      setError('Nepodařilo se smazat kategorii');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      min_birth_year: new Date().getFullYear() - 50,
      max_birth_year: new Date().getFullYear() - 18,
      active: true
    });
    setEditingCategory(null);
    setShowForm(false);
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getAgeRange = (category) => {
    const currentYear = new Date().getFullYear();
    const minAge = currentYear - category.max_birth_year;
    const maxAge = currentYear - category.min_birth_year;
    return `${minAge} - ${maxAge} let`;
  };

  const handleCheckCoverage = async () => {
    try {
      setLoading(true);
      const data = await AdminAPI.get('/admin/categories/check/coverage');
      setCoverageReport(data);
      setShowCoverageReport(true);
      setError(null);
    } catch (err) {
      console.error('Error checking coverage:', err);
      setError('Nepodařilo se zkontrolovat pokrytí kategorií');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!window.confirm('Opravdu chcete přepočítat kategorie pro všechny závodníky? Tato operace může trvat několik sekund.')) {
      return;
    }

    try {
      setRecalculating(true);
      const data = await AdminAPI.post('/admin/categories/recalculate/all', {});
      setSuccess(`${data.message}. Celkem: ${data.stats.total}, aktualizováno: ${data.stats.updated}, beze změny: ${data.stats.unchanged}, bez kategorie: ${data.stats.no_category}`);
      setError(null);
    } catch (err) {
      console.error('Error recalculating:', err);
      setError('Nepodařilo se přepočítat kategorie');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Načítání...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1>
              <i className="bi bi-tag me-2"></i>
              Správa kategorií
            </h1>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-info"
                onClick={handleCheckCoverage}
                disabled={loading}
              >
                <i className="bi bi-clipboard-check me-2"></i>
                Kontrola pokrytí
              </button>
              <button 
                className="btn btn-warning"
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                {recalculating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Přepočítávám...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-2"></i>
                    Přepočítat kategorie
                  </>
                )}
              </button>
              <button 
                className="btn btn-success"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Nová kategorie
              </button>
            </div>
          </div>

          {error && (
            <Alert 
              type="danger" 
              message={
                <>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </>
              }
              onDismiss={() => setError(null)}
            />
          )}

          {success && (
            <Alert 
              type="success" 
              message={
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  {success}
                </>
              }
              onDismiss={() => setSuccess('')}
            />
          )}

          {showCoverageReport && coverageReport && (
            <div className="card mb-4 border-info">
              <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-clipboard-check me-2"></i>
                  Výsledek kontroly pokrytí kategorií
                </h5>
                <button 
                  className="btn btn-sm btn-light"
                  onClick={() => setShowCoverageReport(false)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-md-3">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Status</h6>
                        <span className={`badge ${coverageReport.status === 'ok' ? 'bg-success' : 'bg-warning'} fs-6`}>
                          {coverageReport.status === 'ok' ? 'OK' : 'Varování'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Kontrolovaný rozsah</h6>
                        <strong>{coverageReport.check_range?.min} - {coverageReport.check_range?.max}</strong>
                        <br />
                        <small className="text-muted">({coverageReport.check_range?.total_years} let)</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Aktivních kategorií</h6>
                        <strong>{coverageReport.active_categories}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-light">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Nepokrytých roků</h6>
                        <strong className="text-danger">
                          {coverageReport.total_gap_years || 0}
                        </strong>
                        {coverageReport.gap_ranges && coverageReport.gap_ranges.length > 0 && (
                          <>
                            <br />
                            <small className="text-muted">v {coverageReport.gap_ranges.length} rozsazích</small>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {coverageReport.racer_range && (
                  <div className="alert alert-light border">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Závodníci v databázi:</strong> ročníky {coverageReport.racer_range.min} – {coverageReport.racer_range.max}
                  </div>
                )}

                <div className="alert alert-info mb-3">
                  <i className="bi bi-info-circle me-2"></i>
                  {coverageReport.message}
                </div>

                {coverageReport.gap_ranges && coverageReport.gap_ranges.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      Nepokryté rozsahy ({coverageReport.gap_ranges.length} {coverageReport.gap_ranges.length === 1 ? 'rozsah' : coverageReport.gap_ranges.length < 5 ? 'rozsahy' : 'rozsahů'})
                    </h6>
                    <div className="alert alert-danger">
                      <ul className="mb-0">
                        {coverageReport.gap_ranges.map((gap, idx) => (
                          <li key={idx}>
                            <strong>{gap.message}</strong>
                            {gap.count > 10 && (
                              <span className="badge bg-danger ms-2">{gap.count} roků</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {coverageReport.overlaps.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-warning">
                      <i className="bi bi-exclamation-circle me-2"></i>
                      Překrývající se ročníky ({coverageReport.overlaps.length})
                    </h6>
                    <div className="alert alert-warning">
                      <ul className="mb-0">
                        {coverageReport.overlaps.map((overlap, idx) => (
                          <li key={idx}>{overlap.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {coverageReport.inactive_categories.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-muted">
                      <i className="bi bi-archive me-2"></i>
                      Neaktivní kategorie ({coverageReport.inactive_categories.length})
                    </h6>
                    <div className="alert alert-secondary">
                      <ul className="mb-0">
                        {coverageReport.inactive_categories.map((cat, idx) => (
                          <li key={idx}>
                            <strong>{cat.name}</strong> (ročníky {cat.range})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {(!coverageReport.gap_ranges || coverageReport.gap_ranges.length === 0) && 
                 (!coverageReport.overlaps || coverageReport.overlaps.length === 0) && (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2"></i>
                    Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi bez překryvů.
                  </div>
                )}
              </div>
            </div>
          )}

          {showForm && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  {editingCategory ? 'Upravit kategorii' : 'Nová kategorie'}
                </h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label htmlFor="name" className="form-label">
                        Název kategorie <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="např. Junioři, Senioři, Veteráni"
                      />
                    </div>
                    
                    <div className="col-md-3 mb-3">
                      <label htmlFor="min_birth_year" className="form-label">
                        Nejstarší ročník <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        id="min_birth_year"
                        name="min_birth_year"
                        value={formData.min_birth_year}
                        onChange={handleChange}
                        required
                        min="1900"
                        max={new Date().getFullYear()}
                        placeholder="např. 1990"
                      />
                      <small className="text-muted">
                        Věk: {new Date().getFullYear() - formData.min_birth_year} let
                      </small>
                    </div>
                    
                    <div className="col-md-3 mb-3">
                      <label htmlFor="max_birth_year" className="form-label">
                        Nejmladší ročník <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        id="max_birth_year"
                        name="max_birth_year"
                        value={formData.max_birth_year}
                        onChange={handleChange}
                        required
                        min="1900"
                        max={new Date().getFullYear()}
                        placeholder="např. 2005"
                      />
                      <small className="text-muted">
                        Věk: {new Date().getFullYear() - formData.max_birth_year} let
                      </small>
                    </div>
                    
                    <div className="col-md-2 mb-3">
                      <label htmlFor="active" className="form-label">
                        Stav
                      </label>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="active"
                          name="active"
                          checked={formData.active}
                          onChange={handleChange}
                        />
                        <label className="form-check-label" htmlFor="active">
                          {formData.active ? 'Aktivní' : 'Neaktivní'}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-save me-2"></i>
                      {editingCategory ? 'Uložit změny' : 'Vytvořit kategorii'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={resetForm}
                    >
                      Zrušit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Seznam kategorií</h5>
            </div>
            <div className="card-body">
              {categories.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-inbox display-1 text-muted"></i>
                  <p className="text-muted mt-2">Zatím nebyly vytvořeny žádné kategorie</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead className="table-dark">
                      <tr>
                        <th>Název</th>
                        <th>Ročníky</th>
                        <th>Věkový rozsah</th>
                        <th>Stav</th>
                        <th>Vytvořeno</th>
                        <th>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(category => (
                        <tr key={category.id}>
                          <td>
                            <strong>{category.name}</strong>
                          </td>
                          <td>
                            <code className="bg-light px-2 py-1 rounded">
                              {category.min_birth_year} - {category.max_birth_year}
                            </code>
                          </td>
                          <td>
                            <span className="badge bg-info text-dark">
                              {getAgeRange(category)}
                            </span>
                          </td>
                          <td>
                            {category.active ? (
                              <span className="badge bg-success">Aktivní</span>
                            ) : (
                              <span className="badge bg-secondary">Neaktivní</span>
                            )}
                          </td>
                          <td>
                            {new Date(category.created_at).toLocaleDateString('cs-CZ')}
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button 
                                className="btn btn-outline-primary" 
                                onClick={() => handleEdit(category)}
                                title="Upravit kategorii"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button 
                                className="btn btn-outline-danger" 
                                onClick={() => handleDelete(category.id)}
                                title="Smazat kategorii"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
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
      </div>
    </div>
  );
}
