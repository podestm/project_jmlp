import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/api.js';

export default function TimekeeperDashboard() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadRaces();
  }, []);

  const loadRaces = async () => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) {
      setError('Nepodařilo se načíst závody');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectRace = (raceId) => {
    // Store selected race for other pages
    localStorage.setItem('timekeeper_selected_race', raceId);
    navigate('/timekeeper/start-list');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const isUpcoming = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) >= new Date(new Date().setHours(0, 0, 0, 0));
  };

  const isPast = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" style={{ color: '#e94560' }} role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="text-muted mt-3">Načítám závody...</p>
      </div>
    );
  }

  const upcomingRaces = races.filter(r => isUpcoming(r.datum));
  const pastRaces = races.filter(r => isPast(r.datum));

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-stopwatch me-2" style={{ color: '#e94560' }}></i>
            Přehled závodů
          </h3>
          <p className="text-muted mb-0">Vyberte závod pro správu startovní listiny a zadávání časů</p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={loadRaces}>
          <i className="bi bi-arrow-clockwise me-1"></i> Obnovit
        </button>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </div>
      )}

      {/* Upcoming races */}
      {upcomingRaces.length > 0 && (
        <div className="mb-4">
          <h5 className="fw-semibold mb-3">
            <i className="bi bi-calendar-event me-2 text-success"></i>
            Nadcházející závody
          </h5>
          <div className="row g-3">
            {upcomingRaces.map(race => (
              <div key={race.id} className="col-md-6 col-lg-4">
                <div 
                  className="card h-100 border-0 shadow-sm"
                  style={{ borderRadius: '12px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onClick={() => selectRace(race.id)}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge" style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', fontSize: '0.85rem' }}>
                        {race.raceNr || `#${race.id}`}
                      </span>
                      <span className="badge bg-success">Nadcházející</span>
                    </div>
                    <h6 className="fw-bold mb-1">{race.areal_name || 'Neznámé místo'}</h6>
                    <div className="text-muted small mb-3">
                      <i className="bi bi-calendar3 me-1"></i>
                      {formatDate(race.datum)}
                    </div>
                    <div className="d-flex gap-3">
                      <div className="text-center">
                        <div className="fw-bold" style={{ color: '#e94560', fontSize: '1.5rem' }}>{race.reg_count || 0}</div>
                        <small className="text-muted">Registrací</small>
                      </div>
                      <div className="text-center">
                        <div className="fw-bold text-primary" style={{ fontSize: '1.5rem' }}>{race.start_list_count || 0}</div>
                        <small className="text-muted">Na listině</small>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-0 text-end pb-3 pe-3">
                    <small style={{ color: '#e94560' }}>
                      Vybrat závod <i className="bi bi-arrow-right"></i>
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past races */}
      {pastRaces.length > 0 && (
        <div>
          <h5 className="fw-semibold mb-3">
            <i className="bi bi-clock-history me-2 text-secondary"></i>
            Proběhlé závody
          </h5>
          <div className="row g-3">
            {pastRaces.map(race => (
              <div key={race.id} className="col-md-6 col-lg-4">
                <div 
                  className="card h-100 border-0 shadow-sm"
                  style={{ borderRadius: '12px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', opacity: 0.85 }}
                  onClick={() => selectRace(race.id)}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '0.85'; }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-secondary" style={{ fontSize: '0.85rem' }}>
                        {race.raceNr || `#${race.id}`}
                      </span>
                      <span className="badge bg-light text-secondary">Proběhlý</span>
                    </div>
                    <h6 className="fw-bold mb-1">{race.areal_name || 'Neznámé místo'}</h6>
                    <div className="text-muted small mb-3">
                      <i className="bi bi-calendar3 me-1"></i>
                      {formatDate(race.datum)}
                    </div>
                    <div className="d-flex gap-3">
                      <div className="text-center">
                        <div className="fw-bold text-secondary" style={{ fontSize: '1.5rem' }}>{race.reg_count || 0}</div>
                        <small className="text-muted">Registrací</small>
                      </div>
                      <div className="text-center">
                        <div className="fw-bold text-secondary" style={{ fontSize: '1.5rem' }}>{race.start_list_count || 0}</div>
                        <small className="text-muted">Na listině</small>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-0 text-end pb-3 pe-3">
                    <small className="text-muted">
                      Zobrazit <i className="bi bi-arrow-right"></i>
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {races.length === 0 && !error && (
        <div className="text-center py-5">
          <i className="bi bi-calendar-x text-muted" style={{ fontSize: '3rem' }}></i>
          <p className="text-muted mt-3">Žádné závody v aktuální sezóně</p>
        </div>
      )}
    </div>
  );
}
