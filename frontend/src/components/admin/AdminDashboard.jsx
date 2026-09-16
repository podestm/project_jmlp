import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminAPI } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import VisitsChart from './VisitsChart.jsx';
import { useRevalidateOnFocus } from '../../hooks/useRevalidateOnFocus.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // silent: obnova na pozadí - bez spinneru a bez chybové hlášky přes čísla,
  // která už na obrazovce jsou
  const loadDashboardData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const result = await AdminAPI.get('/api/admin/dashboard/stats');
      setData(result);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useRevalidateOnFocus(() => loadDashboardData({ silent: true }));

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert 
        type="danger" 
        message={<><i className="bi bi-exclamation-triangle-fill me-2"></i>Chyba při načítání: {error}</>}
        onDismiss={() => setError(null)}
      />
    );
  }

  const { counts, visits, upcoming_race, recent_registrations, top_pages, recent_posts, season } = data;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const pathLabels = {
    '/zavody': 'Závody',
    '/archiv-zprav': 'Archiv zpráv',
    '/dokumenty': 'Dokumenty',
    '/kontakty': 'Kontakty',
  };

  const getPathLabel = (path) => {
    if (pathLabels[path]) return pathLabels[path];
    return path;
  };

  return (
    <div className="admin-section">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-1">Dashboard</h1>
          <span className="text-muted">
            <i className="bi bi-calendar3 me-1"></i>
            Sezóna {season.label}
          </span>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={loadDashboardData}>
          <i className="bi bi-arrow-clockwise me-1"></i>Obnovit
        </button>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="dashboard-icon-box dashboard-icon-primary me-3">
                  <i className="bi bi-people-fill fs-4"></i>
                </div>
                <div>
                  <div className="fs-3 fw-bold">{counts.total_racers.toLocaleString('cs-CZ')}</div>
                  <small className="text-muted">Závodníků</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="dashboard-icon-box dashboard-icon-success me-3">
                  <i className="bi bi-hdd-fill fs-4"></i>
                </div>
                <div>
                  <div className="fs-3 fw-bold">{counts.storage_size}</div>
                  <small className="text-muted">Nahraných souborů</small>
                  {counts.file_count > 0 && <div><small className="text-muted" style={{fontSize: '0.7rem'}}>{counts.file_count} souborů</small></div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="dashboard-icon-box dashboard-icon-warning me-3">
                  <i className="bi bi-trophy-fill fs-4"></i>
                </div>
                <div>
                  <div className="fs-3 fw-bold">{counts.season_races}</div>
                  <small className="text-muted">Závodů v sezóně</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="dashboard-icon-box dashboard-icon-info me-3">
                  <i className="bi bi-eye-fill fs-4"></i>
                </div>
                <div>
                  <div className="fs-3 fw-bold">{visits.today.toLocaleString('cs-CZ')}</div>
                  <small className="text-muted">Návštěv dnes</small>
                  <div><small className="text-muted" style={{fontSize: '0.7rem'}}>{visits.today_unique} unikátních</small></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Club Requests Alert */}
      {counts.pending_club_requests > 0 && (
        <div className="card border-warning shadow-sm mb-4">
          <div className="card-body d-flex align-items-center gap-3">
            <div className="dashboard-icon-box" style={{ background: 'rgba(255,193,7,0.15)', color: '#856404' }}>
              <i className="bi bi-building fs-4"></i>
            </div>
            <div className="flex-grow-1">
              <div className="fw-semibold">Nevyřízené žádosti o přiřazení klubu</div>
              <small className="text-muted">{counts.pending_club_requests} závodníků čeká na přiřazení klubu</small>
            </div>
            <a href="/admin/club-requests" className="btn btn-warning btn-sm">
              Vyřídit žádosti <i className="bi bi-arrow-right ms-1"></i>
            </a>
          </div>
        </div>
      )}

      {/* Upcoming Race Highlight */}
      {upcoming_race && (
        <div className="card border-0 shadow-sm mb-4 dashboard-upcoming-race">
          <div className="card-body text-white py-3">
            <div className="row align-items-center">
              <div className="col-auto">
                <div className="dashboard-upcoming-icon">
                  <i className="bi bi-flag-fill fs-4"></i>
                </div>
              </div>
              <div className="col">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <h5 className="mb-0 text-white" style={{color: 'white !important'}}>
                    Nadcházející závod: {upcoming_race.race_nr || `#${upcoming_race.id}`}
                  </h5>
                  {upcoming_race.registration && (
                    <span className="badge bg-white bg-opacity-25 text-white">
                      <i className="bi bi-door-open me-1"></i>Registrace otevřena
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-3 opacity-75">
                  <span><i className="bi bi-calendar3 me-1"></i>{formatDate(upcoming_race.datum)}</span>
                  {upcoming_race.areal_name && <span><i className="bi bi-geo-alt me-1"></i>{upcoming_race.areal_name}</span>}
                  <span><i className="bi bi-people me-1"></i>{upcoming_race.registration_count} registrovaných</span>
                </div>
              </div>
              <div className="col-auto d-none d-md-block text-end">
                {upcoming_race.days_until !== null && (
                  <div>
                    <div className="fs-2 fw-bold">{upcoming_race.days_until}</div>
                    <small className="opacity-75">{upcoming_race.days_until === 1 ? 'den' : upcoming_race.days_until >= 2 && upcoming_race.days_until <= 4 ? 'dny' : 'dní'}</small>
                  </div>
                )}
              </div>
              <div className="col-auto">
                <Link to="/admin/races" className="btn btn-outline-light btn-sm">
                  <i className="bi bi-arrow-right me-1"></i>Detail
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visits Chart */}
      <div className="mb-4">
        <VisitsChart />
      </div>

      {/* Bottom Row: Recent Activity + Sidebar */}
      <div className="row g-3">
        {/* Left: Recent Registrations + Recent Posts */}
        <div className="col-lg-8">
          {/* Recent Registrations */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="bi bi-clock-history me-2"></i>
                Poslední registrace
              </h6>
              <Link to="/admin/races" className="btn btn-link btn-sm p-0 text-decoration-none">
                Všechny závody <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            <div className="card-body p-0">
              {recent_registrations.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0">Žádné registrace</p>
              ) : (
                <div className="list-group list-group-flush">
                  {recent_registrations.map((reg, idx) => (
                    <div key={idx} className="list-group-item px-3 py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className="fw-semibold">{reg.racer_name} {reg.racer_surname}</span>
                          {reg.club_name && <span className="text-muted ms-2 small">({reg.club_name})</span>}
                        </div>
                        <div className="text-end">
                          <span className="badge bg-primary me-1">Závod {reg.race_nr || '?'}</span>
                          {reg.areal_name && <small className="text-muted d-none d-md-inline">{reg.areal_name}</small>}
                        </div>
                      </div>
                      <small className="text-muted">{formatDateTime(reg.registered_at)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="bi bi-newspaper me-2"></i>
                Poslední příspěvky
              </h6>
              <Link to="/admin/posts" className="btn btn-link btn-sm p-0 text-decoration-none">
                Správa příspěvků <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            <div className="card-body p-0">
              {recent_posts.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0">Žádné příspěvky</p>
              ) : (
                <div className="list-group list-group-flush">
                  {recent_posts.map((post) => (
                    <div key={post.id} className="list-group-item px-3 py-2 d-flex justify-content-between align-items-center">
                      <div>
                        <span className="fw-semibold">{post.title}</span>
                        <br />
                        <small className="text-muted">{formatDateTime(post.created_at)}</small>
                      </div>
                      <span className={`badge ${post.published ? 'bg-success' : 'bg-secondary'}`}>
                        {post.published ? 'Publikováno' : 'Koncept'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-lg-4">
          {/* Top Pages */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-transparent border-bottom">
              <h6 className="mb-0">
                <i className="bi bi-bar-chart me-2"></i>
                Nejnavštěvovanější stránky
              </h6>
              <small className="text-muted">posledních 30 dní</small>
            </div>
            <div className="card-body p-0">
              {top_pages.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0">Žádná data</p>
              ) : (
                <div className="list-group list-group-flush">
                  {top_pages.map((page, idx) => (
                    <div key={idx} className="list-group-item px-3 py-2 d-flex justify-content-between align-items-center">
                      <span className="text-truncate me-2" style={{maxWidth: '180px'}} title={page.path}>
                        {getPathLabel(page.path)}
                      </span>
                      <span className="badge bg-primary">{page.visits.toLocaleString('cs-CZ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-transparent border-bottom">
              <h6 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Přehled systému
              </h6>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between py-1 border-bottom">
                <span className="text-muted">Aktivní kluby</span>
                <strong>{counts.total_clubs}</strong>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom">
                <span className="text-muted">Otevřené registrace</span>
                <strong>{counts.open_registrations}</strong>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom">
                <span className="text-muted">Celkem příspěvků</span>
                <strong>{counts.total_posts}</strong>
              </div>
              <div className="d-flex justify-content-between py-1">
                <span className="text-muted">Návštěvy (7 dní)</span>
                <strong>{visits.last_7_days.toLocaleString('cs-CZ')}</strong>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-bottom">
              <h6 className="mb-0">
                <i className="bi bi-lightning me-2"></i>
                Rychlé akce
              </h6>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <Link to="/admin/races" className="btn btn-primary btn-sm">
                  <i className="bi bi-plus-circle me-2"></i>Nový závod
                </Link>
                <Link to="/admin/posts" className="btn btn-outline-success btn-sm">
                  <i className="bi bi-pencil me-2"></i>Nový příspěvek
                </Link>
                <Link to="/admin/documents" className="btn btn-outline-secondary btn-sm">
                  <i className="bi bi-upload me-2"></i>Nahrát dokumenty
                </Link>
                <hr className="my-1" />
                <a href="/" target="_blank" className="btn btn-outline-info btn-sm">
                  <i className="bi bi-box-arrow-up-right me-2"></i>Zobrazit web
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}