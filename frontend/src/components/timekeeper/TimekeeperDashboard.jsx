import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TimekeeperAPI } from '../../config/timekeeperApi.js';
import { TK_ACCENT, TK_ACCENT_GRADIENT } from './TimekeeperChrome.jsx';

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
        <div className="spinner-border spinner-border-sm" style={{ color: TK_ACCENT }}></div>
        <small className="text-muted ms-2">Načítám závody...</small>
      </div>
    );
  }

  const upcomingRaces = races.filter(r => isUpcoming(r.datum));
  const pastRaces = races.filter(r => isPast(r.datum));
  const lastSelectedRaceId = localStorage.getItem('timekeeper_selected_race') || '';

  // Závod na jeden řádek - dřív to byly vysoké karty ve dvou sloupcích.
  const renderRaceCard = (race, status) => {
    const isPastRace = status === 'past';
    const isSelected = String(race.id) === String(lastSelectedRaceId);

    return (
      <div key={race.id} className={`card shadow-sm timekeeper-race-card ${isPastRace ? 'is-past' : 'is-upcoming'}`}>
        <div className="card-body py-2 px-3 d-flex align-items-center flex-wrap gap-2 column-gap-3">
          <span
            className={`badge ${isPastRace ? 'bg-secondary' : ''}`}
            style={!isPastRace ? { background: TK_ACCENT_GRADIENT } : undefined}
          >
            {race.race_nr || `#${race.id}`}
          </span>

          <div className="flex-grow-1" style={{ minWidth: '12rem' }}>
            <div className="fw-bold">
              {race.areal_name || 'Neznámé místo'}
              {isSelected && <span className="badge bg-primary-subtle ms-2">Naposledy vybraný</span>}
            </div>
            <small className="text-muted">
              <i className="bi bi-calendar3 me-1"></i>{formatDate(race.datum)}
            </small>
          </div>

          {/* Počty a tlačítka drží pohromadě vpravo - na úzkém displeji se
              zalomí společně pod název */}
          <div className="d-flex align-items-center flex-wrap justify-content-end gap-2 column-gap-3 ms-auto">
            <div className="d-flex gap-3 small text-nowrap">
              <span><span className="text-muted">Registrací</span> <strong>{race.reg_count || 0}</strong></span>
              <span><span className="text-muted">Na listině</span> <strong>{race.start_list_count || 0}</strong></span>
            </div>

            <div className="d-flex gap-2 flex-shrink-0">
              <button
                className={`btn btn-sm ${race.is_live ? 'text-white' : 'btn-outline-danger'}`}
                style={{
                  borderRadius: '8px',
                  border: race.is_live ? 'none' : undefined,
                  background: race.is_live ? 'linear-gradient(135deg, var(--adm-danger-hover), var(--adm-danger))' : undefined,
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
                  background: isPastRace ? undefined : TK_ACCENT_GRADIENT
                }}
                onClick={() => selectRace(race.id)}
              >
                Otevřít
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{`@layer legacy {
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      }`}</style>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h5 className="fw-bold mb-0">
            <i className="bi bi-stopwatch me-2" style={{ color: TK_ACCENT }}></i>
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
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="fw-semibold text-success">
              <i className="bi bi-calendar-event me-1"></i>Nadcházející závody
            </small>
            <small className="text-muted">{upcomingRaces.length} položek</small>
          </div>
          <div className="d-flex flex-column gap-2">
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
          <div className="d-flex flex-column gap-2">
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
