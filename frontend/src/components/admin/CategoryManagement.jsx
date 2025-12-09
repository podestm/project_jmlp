import React, { useState, useEffect } from 'react';
import { useAuth } from '../../config/auth.jsx';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';

export default function CategoryManagement() {
  const { token, loading: authLoading, isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [coverageReport, setCoverageReport] = useState(null);
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    min_birth_year: new Date().getFullYear() - 50,
    max_birth_year: new Date().getFullYear() - 18,
    sex: 0, // 0 = mix, 1 = muži, 2 = ženy
    active: true
  });

  useEffect(() => {
    // Čakaj kým sa autentifikácia dokončí
    if (!authLoading && isAuthenticated) {
      loadCategories();
    }
  }, [authLoading, isAuthenticated]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setRecalculateResult(null); // Vyčistí predchádzajúce výsledky
      const data = await AdminAPI.get('/api/admin/categories');
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
        await AdminAPI.put(`/api/admin/categories/${editingCategory.id}`, formData);
        setSuccess('Kategorie úspěšně upravena');
      } else {
        await AdminAPI.post('/api/admin/categories', formData);
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
      sex: category.sex,
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
      await AdminAPI.delete(`/api/admin/categories/${categoryId}`);
      setSuccess('Kategorie úspěšně smazána');
      loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      setError('Nepodařilo se smazat kategorii');
    }
  };

  const handleCreateMirror = async (category) => {
    // Určíme opačné pohlaví
    let newSex;
    if (category.sex === 0) {
      // Mix kategorie - necháme jako mix
      setError('Mix kategorie nelze zrcadlit - už funguje pro všechna pohlaví');
      return;
    } else if (category.sex === 1) {
      newSex = 2; // Muži -> Ženy
    } else {
      newSex = 1; // Ženy -> Muži
    }

    const sexName = newSex === 1 ? 'mužskou' : 'ženskou';
    
    if (!window.confirm(`Opravdu chcete vytvořit zrcadlovou ${sexName} kategorii "${category.name}"?`)) {
      return;
    }

    try {
      const mirrorData = {
        name: category.name,
        min_birth_year: category.min_birth_year,
        max_birth_year: category.max_birth_year,
        sex: newSex,
        active: category.active
      };

      await AdminAPI.post('/api/admin/categories', mirrorData);
      setSuccess(`Zrcadlová ${sexName} kategorie "${category.name}" byla úspěšně vytvořena`);
      loadCategories();
    } catch (err) {
      console.error('Error creating mirror category:', err);
      if (err.response?.data?.detail?.includes('existuje')) {
        setError('Kategorie s tímto názvem a pohlavím již existuje');
      } else {
        setError('Nepodařilo se vytvořit zrcadlovou kategorii');
      }
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await AdminAPI.put(`/api/admin/categories/${id}`, {
        active: !currentActive
      });
      
      // Okamžite načítajú aktualizované dáta
      await loadCategories();
      
    } catch (err) {
      console.error('Error toggling category active status:', err);
      setError('Nepodařilo se změnit status kategorie');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      min_birth_year: new Date().getFullYear() - 50,
      max_birth_year: new Date().getFullYear() - 18,
      sex: 0,
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
      setCheckingCoverage(true);
      setRecalculateResult(null); // Vyčistí predchádzajúce výsledky
      const data = await AdminAPI.get('/api/admin/categories/check/coverage');
      setCoverageReport(data);
      setShowCoverageReport(true);
      setError(null);
    } catch (err) {
      console.error('Error checking coverage:', err);
      setError('Nepodařilo se zkontrolovat pokrytí kategorií');
    } finally {
      setCheckingCoverage(false);
    }
  };

  const handleRecalculate = async () => {
    if (!window.confirm('Opravdu chcete přepočítat kategorie pro všechny závodníky? Tato operace může trvat několik sekund a přiřadí kategorie podle roku narození a pohlaví závodníka.')) {
      return;
    }

    try {
      setRecalculating(true);
      setRecalculateResult(null);
      const data = await AdminAPI.post('/api/admin/categories/recalculate/all', {});
      
      // Uložíme celý výsledek pro pokročilé zobrazení
      setRecalculateResult({
        message: data.message,
        stats: data.stats,
        updates: data.updates || [], // Seznam aktualizovaných závodníků
        summary: {
          total_racers: data.stats.total,
          updated_racers: data.stats.updated,
          unchanged_racers: data.stats.unchanged,
          no_category_racers: data.stats.no_category
        }
      });
      
      setError(null);
      
      // Pokud jsou nějaké problémy, zobraz je jako varování
      if (data.stats.no_category > 0) {
        setError(`Varování: ${data.stats.no_category} závodníků nemá vhodnou kategorii podle roku narození a pohlaví. Zkontrolujte pokrytí kategorií.`);
      }
    } catch (err) {
      console.error('Error recalculating:', err);
      setError('Nepodařilo se přepočítat kategorie závodníků');
      setRecalculateResult(null);
    } finally {
      setRecalculating(false);
    }
  };

  if (authLoading || loading) {
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

  // Ak nie je autentifikovaný, presmeruj na login
  if (!isAuthenticated) {
    return (
      <div className="container-fluid">
        <div className="text-center py-5">
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Pro přístup k této stránce se musíte přihlásit.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid admin-section">
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
                disabled={loading || checkingCoverage}
                title="Zkontroluje pokrytí kategorií od roku 1900 do současnosti"
              >
                {checkingCoverage ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Kontroluji...
                  </>
                ) : (
                  <>
                    <i className="bi bi-clipboard-check me-2"></i>
                    Kontrola pokrytí
                  </>
                )}
              </button>
              <button 
                className="btn btn-warning"
                onClick={handleRecalculate}
                disabled={recalculating}
                title="Přepočítá kategorie pro všechny závodníky podle roku narození a pohlaví"
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

          {recalculateResult && (
            <div className="mb-4">
              <div className="alert alert-success d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  <div>
                    <strong>Přepočet kategorií dokončen</strong>
                    <small className="d-block text-muted mt-1">
                      Kategorie byly aktualizovány podle ročníků narození a pohlaví závodníků
                    </small>
                  </div>
                </div>
                <button 
                  className="btn btn-sm btn-outline-secondary" 
                  onClick={() => setRecalculateResult(null)}
                  title="Skrýt výsledky"
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>

              {recalculateResult.updates && recalculateResult.updates.length > 0 && (
                <div className="card">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">
                      <i className="bi bi-arrow-repeat me-2"></i>
                      Aktualizováno {recalculateResult.updates.length} závodníků
                    </h6>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive" style={{maxHeight: '300px', overflowY: 'auto'}}>
                      <table className="table table-sm table-hover mb-0">
                        <thead className="sticky-top bg-light">
                          <tr>
                            <th>Závodník</th>
                            <th>Ročník</th>
                            <th>Pohlaví</th>
                            <th>Změna kategorie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recalculateResult.updates.map((update, idx) => (
                            <tr key={idx}>
                              <td>
                                <strong>{update.name}</strong>
                              </td>
                              <td>
                                <span className="badge bg-secondary">{update.birth_year}</span>
                              </td>
                              <td>
                                <span className={`badge ${
                                  update.sex === 1 ? 'bg-info' : update.sex === 2 ? 'bg-pink' : 'bg-secondary'
                                }`}>
                                  {update.sex === 1 ? 'Muž' : update.sex === 2 ? 'Žena' : 'Mix'}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <span className="text-muted me-2">{update.old_category}</span>
                                  <i className="bi bi-arrow-right text-primary me-2"></i>
                                  <span className="fw-bold">{update.new_category}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {recalculateResult.summary && (
                <div className="row mt-3">
                  <div className="col-md-4">
                    <div className="card bg-transparent border-0 text-center">
                      <div className="card-body py-2">
                        <small className="text-muted d-block">Celkem zkontrolováno</small>
                        <strong>{recalculateResult.summary.total_racers || 0}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card text-center" style={{backgroundColor: 'rgba(13, 110, 253, 0.1)', border: '1px solid rgba(13, 110, 253, 0.3)'}}>
                      <div className="card-body py-2">
                        <small className="d-block">Aktualizováno</small>
                        <strong className="text-primary">{recalculateResult.summary.updated_racers || 0}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card text-center" style={{backgroundColor: 'rgba(25, 135, 84, 0.1)', border: '1px solid rgba(25, 135, 84, 0.3)'}}>
                      <div className="card-body py-2">
                        <small className="d-block">Bez změny</small>
                        <strong className="text-success">{recalculateResult.summary.unchanged_racers || 0}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {success && !recalculateResult && (
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
                    <div className="card bg-transparent border-0">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Status</h6>
                        <span className={`badge ${coverageReport.status === 'ok' ? 'bg-success' : 'bg-warning'} fs-6`}>
                          {coverageReport.status === 'ok' ? 'OK' : 'Varování'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-transparent border-0">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Kontrolovaný rozsah</h6>
                        <strong>{coverageReport.check_range?.min} - {coverageReport.check_range?.max}</strong>
                        <br />
                        <small className="text-muted">({coverageReport.check_range?.total_years} let)</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-transparent border-0">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Aktivních kategorií</h6>
                        <strong>{coverageReport.active_categories}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-transparent border-0">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Nepokryté rozmezí</h6>
                        <strong className="text-danger">
                          {coverageReport.results_by_sex ? 
                            Object.values(coverageReport.results_by_sex).reduce((sum, sexData) => sum + (sexData.gap_ranges?.length || 0), 0) : 
                            (coverageReport.gap_ranges?.length || 0)
                          }
                        </strong>
                        <br />
                        <small className="text-muted">rozmezí celkem</small>
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

                {/* Zobrazení podle pohlaví - přehlednější layout */}
                {coverageReport.results_by_sex && (
                  <div className="row mb-4">
                    {Object.entries(coverageReport.results_by_sex).map(([sexName, sexData]) => (
                      <div key={sexName} className="col-md-6 mb-3">
                        <div className="card h-100 border-primary" style={{backgroundColor: 'rgba(13, 110, 253, 0.05)'}}>
                          <div className="card-header bg-primary text-white">
                            <h6 className="mb-0">
                              <i className={`bi ${sexName === 'Muži' ? 'bi-person-fill' : 'bi-person-dress-fill'} me-2`}></i>
                              {sexName}
                            </h6>
                          </div>
                          <div className="card-body">
                            <div className="row text-center mb-3">
                              <div className="col-6">
                                <div className="border rounded p-2">
                                  <small className="text-muted d-block">Nepokryté rozsahy</small>
                                  <strong className={sexData.gap_ranges?.length > 0 ? 'text-danger' : 'text-success'}>
                                    {sexData.gap_ranges?.length || 0}
                                  </strong>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="border rounded p-2">
                                  <small className="text-muted d-block">Překryvy</small>
                                  <strong className={sexData.overlap_details?.length > 0 ? 'text-warning' : 'text-success'}>
                                    {sexData.overlap_details?.length || 0}
                                  </strong>
                                </div>
                              </div>
                            </div>
                            
                            {sexData.gap_ranges && sexData.gap_ranges.length > 0 && (
                              <div className="mb-3">
                                <div className="alert alert-danger alert-sm p-2">
                                  <small className="fw-bold text-danger d-block mb-1">
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    Nepokryté rozsahy:
                                  </small>
                                  {sexData.gap_ranges.map((gap, idx) => (
                                    <small key={idx} className="d-block">
                                      • {gap.start === gap.end ? 
                                          `Ročník ${gap.start}` : 
                                          `Ročníky ${gap.start}–${gap.end} (${gap.count} let)`}
                                    </small>
                                  ))}
                                </div>
                              </div>
                            )}

                            {sexData.overlap_details && sexData.overlap_details.length > 0 && (
                              <div className="mb-3">
                                <div className="alert alert-warning alert-sm p-2">
                                  <small className="fw-bold text-warning d-block mb-1">
                                    <i className="bi bi-exclamation-circle me-1"></i>
                                    Překryvy:
                                  </small>
                                  {sexData.overlap_details.slice(0, 3).map((overlap, idx) => (
                                    <small key={idx} className="d-block">
                                      • Ročník {overlap.year}
                                    </small>
                                  ))}
                                  {sexData.overlap_details.length > 3 && (
                                    <small className="text-muted">
                                      ... a {sexData.overlap_details.length - 3} dalších
                                    </small>
                                  )}
                                </div>
                              </div>
                            )}

                            {(!sexData.gap_ranges || sexData.gap_ranges.length === 0) && 
                             (!sexData.overlap_details || sexData.overlap_details.length === 0) && (
                              <div className="alert alert-success alert-sm p-2 text-center">
                                <i className="bi bi-check-circle me-1"></i>
                                <small>Všechny ročníky OK</small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Detailní informace - skrytelné */}
                {coverageReport.results_by_sex && (
                  <div className="mb-3">
                    <button 
                      className="btn btn-outline-info btn-sm mb-2" 
                      type="button" 
                      data-bs-toggle="collapse" 
                      data-bs-target="#detailsCollapse"
                    >
                      <i className="bi bi-chevron-down me-1"></i>
                      Zobrazit detaily
                    </button>
                    <div className="collapse" id="detailsCollapse">
                      {Object.entries(coverageReport.results_by_sex).map(([sexName, sexData]) => (
                        <div key={`details-${sexName}`} className="mb-3">
                          <h6 className="text-muted">Detaily pro {sexName}:</h6>
                          
                          {sexData.gap_ranges && sexData.gap_ranges.length > 0 && (
                            <div className="alert alert-danger">
                              <strong>Nepokryté rozsahy ({sexData.gap_ranges.length}):</strong>
                              <ul className="mb-0 mt-1">
                                {sexData.gap_ranges.map((gap, idx) => (
                                  <li key={idx}>{gap.message}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {sexData.overlap_details && sexData.overlap_details.length > 0 && (
                            <div className="alert alert-warning">
                              <strong>Překrývající se ročníky ({sexData.overlap_details.length}):</strong>
                              <ul className="mb-0 mt-1">
                                {sexData.overlap_details.map((overlap, idx) => (
                                  <li key={idx}>{overlap.message}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback pro staré API odpovědi bez results_by_sex */}
                {!coverageReport.results_by_sex && (
                  <>
                    {coverageReport.gap_ranges && coverageReport.gap_ranges.length > 0 && (
                      <div className="mb-3">
                        <h6 className="text-danger">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          Nepokryté rozsahy ({coverageReport.gap_ranges.length})
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

                    {coverageReport.overlaps && coverageReport.overlaps.length > 0 && (
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
                  </>
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
                            <strong>{cat.name}</strong> 
                            {cat.sex && (
                              <span className={`badge ms-2 ${
                                cat.sex === 'Mix' ? 'bg-secondary' : 
                                cat.sex === 'Muži' ? 'bg-primary' : 'bg-warning'
                              }`}>
                                {cat.sex}
                              </span>
                            )}
                            <span className="text-muted ms-2">(ročníky {cat.range})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Celkový úspěch - zobrazí se jen pokud není results_by_sex, nebo když jsou všechna pohlaví OK */}
                {!coverageReport.results_by_sex && 
                 (!coverageReport.gap_ranges || coverageReport.gap_ranges.length === 0) && 
                 (!coverageReport.overlaps || coverageReport.overlaps.length === 0) && (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2"></i>
                    Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi bez překryvů.
                  </div>
                )}

                {coverageReport.results_by_sex && 
                 Object.values(coverageReport.results_by_sex).every(sexData => 
                   (!sexData.gap_ranges || sexData.gap_ranges.length === 0) && 
                   (!sexData.overlap_details || sexData.overlap_details.length === 0)
                 ) && (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2"></i>
                    Všechny ročníky od roku 1900 do současnosti jsou správně pokryty kategoriemi pro obě pohlaví bez překryvů.
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
                    <div className="col-md-3 mb-3">
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
                    
                    <div className="col-md-2 mb-3">
                      <label htmlFor="sex" className="form-label">
                        Pohlaví <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        id="sex"
                        name="sex"
                        value={formData.sex}
                        onChange={handleChange}
                        required
                      >
                        <option value={0}>Mix (muži i ženy)</option>
                        <option value={1}>Muži</option>
                        <option value={2}>Ženy</option>
                      </select>
                    </div>
                    
                    <div className="col-md-2 mb-3">
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
                    
                    <div className="col-md-2 mb-3">
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
                    
                    <div className="col-md-3 mb-3">
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
                        <th>Pohlaví</th>
                        <th>Ročníky</th>
                        <th>Věkový rozsah</th>
                        <th>Stav</th>
                        <th>Vytvořeno</th>
                        <th>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories
                        .sort((a, b) => {
                          // Primárně podle věku (od nejmladších po nejstarší)
                          const ageSort = b.max_birth_year - a.max_birth_year;
                          if (ageSort !== 0) return ageSort;
                          
                          // Sekundárně podle pohlaví: Mix(0), Muži(1), Ženy(2)
                          return a.sex - b.sex;
                        })
                        .map(category => (
                        <tr key={category.id}>
                          <td>
                            <strong>{category.name}</strong>
                          </td>
                          <td>
                            <span className={`badge ${
                              category.sex === 0 ? 'bg-secondary' : 
                              category.sex === 1 ? 'bg-primary' : 'bg-warning'
                            }`}>
                              {category.sex === 0 ? 'Mix' : 
                               category.sex === 1 ? 'Muži' : 'Ženy'}
                            </span>
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
                                className="btn btn-outline-info" 
                                onClick={() => handleCreateMirror(category)}
                                title={`Vytvořit zrcadlovou kategorii pro ${category.sex === 1 ? 'ženy' : category.sex === 2 ? 'muže' : 'opačné pohlaví'}`}
                                disabled={category.sex === 0}
                              >
                                <i className="bi bi-arrows-angle-expand"></i>
                              </button>
                              <button 
                                className={`btn btn-outline-${category.active ? 'warning' : 'success'}`}
                                onClick={() => handleToggleActive(category.id, category.active)}
                                title={category.active ? 'Deaktivovat kategorii' : 'Aktivovat kategorii'}
                              >
                                <i className={`bi ${category.active ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
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
