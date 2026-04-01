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
      setError('');
    } catch (err) {
      setError('Nepodařilo se načíst závody');
      console.error(err);
    } finally { setLoading(false); }
  };

  const selectRace = (raceId) => {
    localStorage.setItem('timekeeper_selected_race', raceId);
    navigate('/timekeeper/start-list');
  };

  const toggleLive = async (raceId, e) => {
    e.stopPropagation();
    try {
      await TimekeeperAPI.put(`/api/timekeeper/races/${raceId}/live`, {});
      await loadRaces();
    } catch (err) {
      console.error('Nepodařilo se změnit live stav:', err);
      setError(`Nepodařilo se změnit live stav: ${err.detail || err.message || 'Neznámá chyba'}`);
    }
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
  const lastSelectedRaceId = localStorage.getItem('timekeeper_selected_race') || '';
  const lastSelectedRace = races.find(race => String(race.id) === String(lastSelectedRaceId));
  const totalRegistrations = races.reduce((sum, race) => sum + (race.reg_count || 0), 0);
  const totalStartListEntries = races.reduce((sum, race) => sum + (race.start_list_count || 0), 0);

  const renderRaceCard = (race, status) => {
    const isPastRace = status === 'past';

    return (
      <div key={race.id} className="col-xl-6">
        <div className={`card border-0 shadow-sm h-100 timekeeper-race-card ${isPastRace ? 'is-past' : 'is-upcoming'}`} style={{ borderRadius: '10px' }}>
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                  <span className={`badge ${isPastRace ? 'bg-secondary' : ''}`} style={!isPastRace ? { background: 'linear-gradient(135deg, #e94560, #c23152)' } : undefined}>
                    {race.race_nr || `#${race.id}`}
                  </span>
                  <span className={`badge ${isPastRace ? 'bg-light text-secondary' : 'bg-success'}`}>
                    {isPastRace ? 'Proběhlý' : 'Nadcházející'}
                  </span>
                </div>

                <h6 className="fw-bold mb-1">{race.areal_name || 'Neznámé místo'}</h6>
                <small className="text-muted d-block">
                  <i className="bi bi-calendar3 me-1"></i>{formatDate(race.datum)}
                </small>
              </div>

              <div className="d-flex gap-2 flex-shrink-0">
                <button
                  className={`btn btn-sm ${race.is_live ? 'text-white' : 'btn-outline-danger'}`}
                  style={{
                    borderRadius: '8px',
                    border: race.is_live ? 'none' : undefined,
                    background: race.is_live ? 'linear-gradient(135deg, #c0392b, #e74c3c)' : undefined,
                    minWidth: '72px'
                  }}
                  onClick={(e) => toggleLive(race.id, e)}
                  title={race.is_live ? 'Ukončit live přenos' : 'Spustit live přenos'}
                >
                  {race.is_live ? (
                    <><span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#fff', marginRight: '5px', animation: 'livePulse 1.2s ease-in-out infinite' }} />Live</>
                  ) : '🔴 Live'}
                </button>
                <button
                  className={`btn btn-sm ${isPastRace ? 'btn-outline-secondary' : 'text-white'}`}
                  style={{
                    borderRadius: '8px',
                    border: isPastRace ? undefined : 'none',
                    background: isPastRace ? undefined : 'linear-gradient(135deg, #e94560, #c23152)'
                  }}
                  onClick={() => selectRace(race.id)}
                >
                  Otevřít
                </button>
              </div>
              <style>{`
                @keyframes livePulse {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.4; transform: scale(0.8); }
                }
              `}</style>
            </div>

            <div className="row g-2">
              <div className="col-sm-6">
                <div className="timekeeper-race-metric">
                  <small className="text-muted d-block mb-1">Registrací</small>
                  <div className="fw-bold timekeeper-race-metric-value text-danger">
                    {race.reg_count || 0}
                  </div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="timekeeper-race-metric">
                  <small className="text-muted d-block mb-1">Na listině</small>
                  <div className="fw-bold timekeeper-race-metric-value text-primary">
                    {race.start_list_count || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
      </div>

      {error && (
        <div className="alert alert-danger py-2 d-flex align-items-center small" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
        </div>
      )}

      <div className="card border-0 shadow-sm mb-3 timekeeper-overview-panel" style={{ borderRadius: '10px' }}>
        <div className="card-body py-3 px-3">
          <div className="row g-3 align-items-center">
            <div className="col-lg-5">
              <div className="d-flex align-items-start gap-3">
                <div className="timekeeper-overview-icon">
                  <i className="bi bi-flag"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-1">Vyberte aktivní závod</h6>
                  <small className="text-muted d-block">
                    Přehled slouží jako vstup do dalších nástrojů timekeeper sekce. Po výběru závodu přejdete rovnou na startovní listinu.
                  </small>
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="row g-2">
                <div className="col-6 col-xl-3">
                  <div className="timekeeper-overview-stat">
                    <small className="text-muted d-block">Celkem závodů</small>
                    <div className="fw-bold">{races.length}</div>
                  </div>
                </div>
                <div className="col-6 col-xl-3">
                  <div className="timekeeper-overview-stat">
                    <small className="text-muted d-block">Nadcházející</small>
                    <div className="fw-bold text-success">{upcomingRaces.length}</div>
                  </div>
                </div>
                <div className="col-6 col-xl-3">
                  <div className="timekeeper-overview-stat">
                    <small className="text-muted d-block">Registrací</small>
                    <div className="fw-bold text-danger">{totalRegistrations}</div>
                  </div>
                </div>
                <div className="col-6 col-xl-3">
                  <div className="timekeeper-overview-stat">
                    <small className="text-muted d-block">Na listině</small>
                    <div className="fw-bold text-primary">{totalStartListEntries}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-1">
                <small className="text-muted">
                  {lastSelectedRace
                    ? `Naposledy vybraný závod: ${lastSelectedRace.race_nr || `#${lastSelectedRace.id}`} — ${lastSelectedRace.areal_name || 'Neznámé místo'}`
                    : 'Závod můžete vybrat z nadcházejících i proběhlých položek níže.'}
                </small>
                <div className="d-flex gap-2">
                  {lastSelectedRace && (
                    <button
                      className="btn btn-sm text-white"
                      style={{ background: 'linear-gradient(135deg, #e94560, #c23152)', border: 'none', borderRadius: '8px' }}
                      onClick={() => selectRace(lastSelectedRace.id)}
                    >
                      <i className="bi bi-arrow-return-right me-1"></i>Pokračovat
                    </button>
                  )}
                  <button className="btn btn-outline-secondary btn-sm" style={{ borderRadius: '8px' }} onClick={loadRaces}>
                    <i className="bi bi-arrow-clockwise me-1"></i>Obnovit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming races */}
      {upcomingRaces.length > 0 && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="fw-semibold text-success">
              <i className="bi bi-calendar-event me-1"></i>Nadcházející závody
            </small>
            <small className="text-muted">{upcomingRaces.length} položek</small>
          </div>
          <div className="row g-3">
            {upcomingRaces.map(race => renderRaceCard(race, 'upcoming'))}
          </div>
        </div>
      )}

      {/* Past races */}
      {pastRaces.length > 0 && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="fw-semibold text-secondary">
              <i className="bi bi-clock-history me-1"></i>Proběhlé závody
            </small>
            <small className="text-muted">{pastRaces.length} položek</small>
          </div>
          <div className="row g-3">
            {pastRaces.map(race => renderRaceCard(race, 'past'))}
          </div>
        </div>
      )}

      {races.length === 0 && !error && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: '10px' }}>
          <div className="card-body text-center py-4">
            <i className="bi bi-calendar-x text-muted" style={{ fontSize: '2rem' }}></i>
            <p className="text-muted mt-2 mb-0 small">Žádné závody v aktuální sezóně</p>
          </div>
        </div>
      )}
    </div>
  );
}
