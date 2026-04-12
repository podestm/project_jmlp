import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding } from '../../utils/text.js';
import { formatDate } from '../../utils/date.js';
import RegistrationForm from '../ui/RegistrationForm.jsx';

function Registration() {
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successCount, setSuccessCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [registrations, setRegistrations] = useState(null);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const allRaces = await API.get(API_CONFIG.ENDPOINTS.RACES, { current_season: true });
        const open = allRaces
          .filter(r => r.registration)
          .map(r => ({ ...r, areal_name: fixEncoding(r.areal_name) }))
          .sort((a, b) => new Date(a.datum) - new Date(b.datum));
        setRaces(open);
        if (open.length === 1) setSelectedRaceId(open[0].id);
      } catch (err) {
        console.error('Chyba pri nacitani zavodu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRaces();
  }, []);

  useEffect(() => {
    if (!selectedRaceId) { setRegistrations(null); return; }
    const fetchRegistrations = async () => {
      setLoadingRegistrations(true);
      try {
        const data = await fetch(`/races/${selectedRaceId}/registrations`).then(r => r.json());
        setRegistrations(data);
      } catch (err) {
        console.error('Chyba pri nacitani registraci:', err);
      } finally {
        setLoadingRegistrations(false);
      }
    };
    fetchRegistrations();
  }, [selectedRaceId, successCount]);

  const selectedRace = races.find(r => r.id === selectedRaceId);

  return (
    <div className="content-wrapper">
      <div className="row justify-content-center">
        <div className="col-lg-10">

          <div className="mb-4" style={{ borderBottom: '2px solid rgba(255,107,0,0.3)', paddingBottom: '0.75rem' }}>
            <h1 className="mb-0" style={{ fontSize: '1.75rem', fontWeight: '500', color: 'var(--text-primary)' }}>
              <span className="bi bi-pencil-square me-2" style={{ color: 'var(--sunset-orange)' }}></span>
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
              <span className="bi bi-info-circle me-2"></span>
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
                        <span className="bi bi-calendar3 me-2" style={{ color: 'var(--sunset-orange)' }}></span>
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
                    <span className="bi bi-calendar-event" style={{ color: 'var(--sunset-orange)', fontSize: '1.2rem' }}></span>
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
                      <i className="bi bi-check-circle-fill me-2"></i>
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

                  {/* Registered racers table */}
                  <div className="card mt-4" style={{
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    <div className="card-header" style={{
                      background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
                      color: 'white',
                      borderTopLeftRadius: '12px',
                      borderTopRightRadius: '12px',
                      padding: '1rem 1.25rem'
                    }}>
                      <h5 className="card-title mb-0">
                        <span className="bi bi-people me-2"></span>
                        Seznam registrovaných závodníků ({registrations?.total_racers || 0})
                      </h5>
                    </div>
                    <div className="card-body">
                      {loadingRegistrations ? (
                        <div className="text-center py-3">
                          <div className="spinner-border spinner-border-sm text-primary" role="status" />
                        </div>
                      ) : !registrations || registrations.total_racers === 0 ? (
                        <div className="text-center text-muted py-3">
                          <span className="bi bi-person-x" style={{ fontSize: '3rem' }}></span>
                          <p className="mt-2">Zatím není nikdo přihlášen</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-hover">
                            <thead className="table-light">
                              <tr>
                                <th>Jméno</th>
                                <th>Příjmení</th>
                                <th>Pohlaví</th>
                                <th>Ročník</th>
                                <th>Kategorie</th>
                                <th>SLČR ID</th>
                                <th>Klub</th>
                              </tr>
                            </thead>
                            <tbody>
                              {registrations.clubs.flatMap(club =>
                                club.racers.map((racer, index) => (
                                  <tr key={`${club.club_name}-${index}`}>
                                    <td>{racer.firstName}</td>
                                    <td>{racer.lastName}</td>
                                    <td>
                                      {racer.sex && (
                                        <span className={`badge ${racer.sex === 'M' ? 'bg-primary' : 'bg-warning'}`}>
                                          {racer.sex === 'M' ? 'Muž' : 'Žena'}
                                        </span>
                                      )}
                                    </td>
                                    <td>{racer.birthYear || '-'}</td>
                                    <td>
                                      {racer.category_name
                                        ? <span className="badge bg-info">{racer.category_name}</span>
                                        : '-'}
                                    </td>
                                    <td className="text-danger">{racer.idSlcr || '-'}</td>
                                    <td><span className="badge bg-secondary">{club.club_name}</span></td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="alert alert-secondary">
                  <span className="bi bi-arrow-up me-2"></span>
                  Vyberte závod výše pro zobrazení registračního formuláře.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Registration;
