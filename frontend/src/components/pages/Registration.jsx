import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding } from '../../utils/text.js';
import { formatDate } from '../../utils/date.js';
import { useRevalidateOnFocus } from '../../hooks/useRevalidateOnFocus.js';
import RegistrationForm from '../ui/RegistrationForm.jsx';
import RegisteredRacersCard, { useRaceRegistrations } from './RegisteredRacersCard.jsx';
import Icon from '../ms/Icon/Icon.jsx';

function Registration() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successCount, setSuccessCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [revalidateCount, setRevalidateCount] = useState(0);

  // successCount a revalidateCount jsou refresh tokeny - seznam se natáhne
  // znovu po každé registraci i po návratu do záložky
  const { registrations, loading: loadingRegistrations } = useRaceRegistrations(
    selectedRaceId, `${successCount}-${revalidateCount}`
  );

  // silent: obnova na pozadí - bez spinneru a bez automatického výběru závodu,
  // který by přepsal, co si člověk mezitím vybral
  const fetchRaces = useCallback(async ({ silent = false } = {}) => {
    try {
      const allRaces = await API.get(API_CONFIG.ENDPOINTS.RACES, { current_season: true });
      const open = allRaces
        .filter(r => r.registration)
        .map(r => ({ ...r, areal_name: fixEncoding(r.areal_name) }))
        .sort((a, b) => new Date(a.datum) - new Date(b.datum));
      setRaces(open);
      if (!silent && open.length === 1) setSelectedRaceId(open[0].id);
    } catch (err) {
      console.error('Chyba pri nacitani zavodu:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  useRevalidateOnFocus(() => {
    fetchRaces({ silent: true });
    setRevalidateCount(count => count + 1);
  });

  const selectedRace = races.find(r => r.id === selectedRaceId);

  return (
    <>

          <div className="mb-4" style={{ borderBottom: '2px solid rgba(255,107,0,0.3)', paddingBottom: '0.75rem' }}>
            <h1 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '500', color: 'var(--text-primary)' }}>
              <Icon name="pencil" className="me-2" style={{ color: 'var(--sunset-orange)' }} />
              Registrace na závod
            </h1>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Načítám...</span>
              </div>
            </div>
          ) : races.length === 0 ? (
            <div className="alert alert-info">
              <Icon name="info" className="me-2" />
              Momentálně není otevřena registrace na žádný závod.
              <div className="mt-2">
                <Link to="/zavody" className="btn btn-sm btn-outline-primary">
                  Zobrazit všechny závody
                </Link>
              </div>
            </div>
          ) : (
            <>
              {races.length > 1 && (
                <div className="mb-4">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    Vyberte závod
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    {races.map(race => (
                      <button
                        key={race.id}
                        onClick={() => setSelectedRaceId(race.id)}
                        className="btn"
                        style={{
                          borderRadius: '8px',
                          border: selectedRaceId === race.id
                            ? '2px solid var(--sunset-orange)'
                            : '1px solid rgba(255,255,255,0.15)',
                          background: selectedRaceId === race.id
                            ? 'rgba(255,107,0,0.15)'
                            : 'var(--glass-bg)',
                          color: 'var(--text-primary)',
                          fontWeight: selectedRaceId === race.id ? '600' : '400',
                          padding: '0.5rem 1rem'
                        }}
                      >
                        <Icon name="calendar" className="me-2" style={{ color: 'var(--sunset-orange)' }} />
                        {formatDate(race.datum)} &mdash; {race.areal_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {races.length === 1 && selectedRace && (
                <div className="mb-4 p-3 rounded" style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div className="d-flex align-items-center gap-2">
                    <Icon name="calendar" style={{ color: 'var(--sunset-orange)', fontSize: '1.2rem' }} />
                    <div>
                      <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>{selectedRace.areal_name}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{formatDate(selectedRace.datum)}</small>
                    </div>
                  </div>
                </div>
              )}

              {selectedRaceId ? (
                <>
                  {successMsg && (
                    <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
                      <Icon name="success" className="me-2" />
                      {successMsg}
                      <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
                    </div>
                  )}
                  <RegistrationForm
                    raceId={selectedRaceId}
                    onSuccess={(result) => {
                      setSuccessCount(c => c + 1);
                      setSuccessMsg(result?.message || 'Registrace proběhla úspěšně!');
                    }}
                  />

                  <RegisteredRacersCard
                    registrations={registrations}
                    loading={loadingRegistrations}
                    className="mt-4"
                  />
                </>
              ) : (
                <div className="alert alert-secondary">
                  <Icon name="arrow-up" className="me-2" />
                  Vyberte závod výše pro zobrazení registračního formuláře.
                </div>
              )}
            </>
          )}
    </>
  );
}

export default Registration;
