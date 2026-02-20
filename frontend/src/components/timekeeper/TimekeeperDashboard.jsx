import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/api.js';

export default function TimekeeperDashboard() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadRaces(); }, []);

  const loadRaces = async () => {
    try {
      setLoading(true);
      const data = await TimekeeperAPI.get('/api/timekeeper/races');
      setRaces(data);
    } catch (err) {
      setError('Nepodařilo se načíst závody');
      console.error(err);
    } finally { setLoading(false); }
  };

  const selectRace = (raceId) => {
    localStorage.setItem('timekeeper_selected_race', raceId);
    navigate('/timekeeper/start-list');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const isUpcoming = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) >= new Date(new Date().setHours(0, 0, 0, 0));
  };

  const isPast = (dateStr) => !isUpcoming(dateStr);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border spinner-border-sm" style={{ color: '#e94560' }}></div>
        <small className="text-muted ms-2">Načítám závody...</small>
      </div>
    );
  }

  const upcomingRaces = races.filter(r => isUpcoming(r.datum));
  const pastRaces = races.filter(r => isPast(r.datum));

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-stopwatch me-2" style={{ color: '#e94560' }}></i>
            Přehled závodů
          </h5>
          <small className="text-muted">Vyberte závod pro správu startovní listiny a zadávání časů</small>
        </div>
        <button className="btn btn-outline-secondary btn-sm" style={{ borderRadius: '8px' }} onClick={loadRaces}>
          <i className="bi bi-arrow-clockwise me-1"></i>Obnovit
        </button>
      </div>

      {error && (
        <div className="alert alert-danger py-2 d-flex align-items-center small" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
        </div>
      )}

      {/* Upcoming races */}
      {upcomingRaces.length > 0 && (
        <div className="mb-3">
          <small className="fw-semibold text-success d-block mb-2">
            <i className="bi bi-calendar-event me-1"></i>Nadcházející závody
          </small>
          <div className="row g-2">
            {upcomingRaces.map(race => (
              <div key={race.id} className="col-md-6 col-lg-4">
                <div
                  className="card h-100 border-0 shadow-sm"
                  style={{ borderRadius: '10px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onClick={() => selectRace(race.id)}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div className="card-body py-3 px-3">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <span className="badge" style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', fontSize: '0.75rem' }}>
                        {race.raceNr || `#${race.id}`}
                      </span>
                      <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>Nadcházející</span>
                    </div>
                    <div className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>{race.areal_name || 'Neznámé místo'}</div>
                    <small className="text-muted d-block mb-2">
                      <i className="bi bi-calendar3 me-1"></i>{formatDate(race.datum)}
                    </small>
                    <div className="d-flex gap-3">
                      <div className="text-center">
                        <div className="fw-bold" style={{ color: '#e94560', fontSize: '1.2rem' }}>{race.reg_count || 0}</div>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>Registrací</small>
                      </div>
                      <div className="text-center">
                        <div className="fw-bold text-primary" style={{ fontSize: '1.2rem' }}>{race.start_list_count || 0}</div>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>Na listině</small>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-0 py-1 text-end pe-3">
                    <small style={{ color: '#e94560', fontSize: '0.75rem' }}>
                      Vybrat <i className="bi bi-arrow-right"></i>
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
          <small className="fw-semibold text-secondary d-block mb-2">
            <i className="bi bi-clock-history me-1"></i>Proběhlé závody
          </small>
          <div className="row g-2">
            {pastRaces.map(race => (
              <div key={race.id} className="col-md-6 col-lg-4">
                <div
                  className="card h-100 border-0 shadow-sm"
                  style={{ borderRadius: '10px', cursor: 'pointer', transition: 'transform 0.15s', opacity: 0.85 }}
                  onClick={() => selectRace(race.id)}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '0.85'; }}
                >
                  <div className="card-body py-3 px-3">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <span className="badge bg-secondary" style={{ fontSize: '0.75rem' }}>
                        {race.raceNr || `#${race.id}`}
                      </span>
                      <span className="badge bg-light text-secondary" style={{ fontSize: '0.65rem' }}>Proběhlý</span>
                    </div>
                    <div className="fw-bold mb-1" style={{ fontSize: '0.9rem' }}>{race.areal_name || 'Neznámé místo'}</div>
                    <small className="text-muted d-block mb-2">
                      <i className="bi bi-calendar3 me-1"></i>{formatDate(race.datum)}
                    </small>
                    <div className="d-flex gap-3">
                      <div className="text-center">
                        <div className="fw-bold text-secondary" style={{ fontSize: '1.2rem' }}>{race.reg_count || 0}</div>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>Registrací</small>
                      </div>
                      <div className="text-center">
                        <div className="fw-bold text-secondary" style={{ fontSize: '1.2rem' }}>{race.start_list_count || 0}</div>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>Na listině</small>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-0 py-1 text-end pe-3">
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
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
        <div className="text-center py-4">
          <i className="bi bi-calendar-x text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 small">Žádné závody v aktuální sezóně</p>
        </div>
      )}
    </div>
  );
}
