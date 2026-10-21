import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';

export default function RaceRegistrations() {
  const { raceId } = useParams();
  const navigate = useNavigate();
  
  const [race, setRace] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clubFilter, setClubFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    loadRaceRegistrations();
  }, [raceId]);

  const loadRaceRegistrations = async () => {
    try {
      setLoading(true);
      
      // Load race details and registrations in parallel
      const [raceData, registrationsData] = await Promise.all([
        AdminAPI.get(`/api/admin/races/${raceId}`),
        AdminAPI.get(`/api/admin/races/${raceId}/registrations`)
      ]);
      
      setRace(raceData);
      setRegistrations(registrationsData);
    } catch (err) {
      console.error('Error loading race registrations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Volby filtrů z přihlášených: kluby abecedně, kategorie v pořadí závodu
  // (nejmladší první, ženy před muži).
  const clubOptions = useMemo(() => (
    [...new Set(registrations.map((r) => r.club_name).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'cs'))
  ), [registrations]);
  const categoryOptions = useMemo(() => {
    const byId = new Map();
    registrations.forEach((r) => {
      const key = r.category_id == null ? 'none' : String(r.category_id);
      if (!byId.has(key)) {
        byId.set(key, { value: key, label: r.category_name || 'Bez kategorie', order: r.category_order ?? 9999 });
      }
    });
    return [...byId.values()].sort((a, b) => a.order - b.order);
  }, [registrations]);

  const filtered = registrations.filter((r) => (
    (!clubFilter || r.club_name === clubFilter)
    && (!categoryFilter || (r.category_id == null ? 'none' : String(r.category_id)) === categoryFilter)
  ));
  const filtersActive = Boolean(clubFilter || categoryFilter);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('cs-CZ');
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert 
        type="danger" 
        message={
          <>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </>
        }
        onDismiss={() => setError(null)}
      />
    );
  }

  return (
    <div className="container-fluid admin-section">
      <div className="row">
        <div className="col-12">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2>Registrace závodu</h2>
              <div className="text-muted">
                <strong>{race?.race_nr || `#${raceId}`}</strong>
                {race && (
                  <>
                    {' • '}
                    {formatDate(race.datum)}
                    {race.areal_name && ` • ${race.areal_name}`}
                  </>
                )}
              </div>
            </div>
            <div>
              <button
                onClick={() => navigate('/admin/races')}
                className="btn btn-outline-secondary me-2"
              >
                <i className="bi bi-arrow-left me-2"></i>
                Zpět na seznam
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card border-primary">
                <div className="card-body text-center">
                  <i className="bi bi-people-fill text-primary fs-2"></i>
                  <h3 className="mt-2">{registrations.length}</h3>
                  <p className="text-muted mb-0">Registrovaných závodníků</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-info">
                <div className="card-body text-center">
                  <i className="bi bi-gender-male text-info fs-2"></i>
                  <h3 className="mt-2">{registrations.filter(r => r.sex === 'M').length}</h3>
                  <p className="text-muted mb-0">Muži</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-warning">
                <div className="card-body text-center">
                  <i className="bi bi-gender-female text-warning fs-2"></i>
                  <h3 className="mt-2">{registrations.filter(r => r.sex === 'Z').length}</h3>
                  <p className="text-muted mb-0">Ženy</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-success">
                <div className="card-body text-center">
                  <i className="bi bi-buildings text-success fs-2"></i>
                  <h3 className="mt-2">{new Set(registrations.map(r => r.club_name)).size}</h3>
                  <p className="text-muted mb-0">Klubů</p>
                </div>
              </div>
            </div>
          </div>

          {/* Registrations Table */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-list me-2"></i>
                Seznam registrovaných závodníků
              </h5>
            </div>
            <div className="card-body">
              {registrations.length > 0 && (
                <div className="row g-2 align-items-end mb-3">
                  <div className="col-12 col-md-4">
                    <label className="form-label small mb-1" htmlFor="registrations-club">
                      <i className="bi bi-buildings me-1"></i>Klub
                    </label>
                    <select
                      id="registrations-club"
                      className="form-select form-select-sm"
                      value={clubFilter}
                      onChange={(e) => setClubFilter(e.target.value)}
                    >
                      <option value="">Všechny kluby</option>
                      {clubOptions.map((club) => <option key={club} value={club}>{club}</option>)}
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small mb-1" htmlFor="registrations-category">
                      <i className="bi bi-tag me-1"></i>Kategorie
                    </label>
                    <select
                      id="registrations-category"
                      className="form-select form-select-sm"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="">Všechny kategorie</option>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-4 d-flex align-items-center gap-2">
                    {filtersActive && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => { setClubFilter(''); setCategoryFilter(''); }}
                      >
                        <i className="bi bi-x-circle me-1"></i>Zrušit
                      </button>
                    )}
                    <small className="text-muted">
                      Zobrazeno {filtered.length} z {registrations.length}
                    </small>
                  </div>
                </div>
              )}
              {registrations.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-info-circle fs-1"></i>
                  <h4 className="mt-3">Žádní registrovaní závodníci</h4>
                  <p>Pro tento závod se zatím nikdo nepřihlásil.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Jméno</th>
                        <th>Příjmení</th>
                        <th>Pohlaví</th>
                        <th>Ročník</th>
                        <th>Kategorie</th>
                        <th>SLČR ID</th>
                        <th>Klub</th>
                        <th>Registrován</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((registration) => (
                        <tr key={registration.registration_id}>
                          <td>
                            <strong>{registration.firstName}</strong>
                          </td>
                          <td>
                            <strong>{registration.lastName}</strong>
                          </td>
                          <td>
                            <span className={`badge ${registration.sex === 'M' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                              {registration.sex === 'M' ? 'Muž' : 'Žena'}
                            </span>
                          </td>
                          <td>{registration.birthYear}</td>
                          <td>{registration.category_name || ''}</td>
                          <td>
                            <code>{registration.idSlcr || ''}</code>
                          </td>
                          <td>
                            <div>
                              <strong>{registration.club_name}</strong>
                            </div>
                          </td>
                          <td>
                            <small className="text-muted">
                              {formatDateTime(registration.registration_date)}
                            </small>
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