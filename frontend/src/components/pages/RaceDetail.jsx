import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDate } from '../../utils/date.js';
import { fixEncoding } from '../../utils/text.js';
import RegistrationForm from '../ui/RegistrationForm.jsx';
import RegisteredRacersCard, { useRaceRegistrations } from './RegisteredRacersCard.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function RaceDetail() {
  const { raceId } = useParams();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');

  // successCount je refresh token - po každé registraci se seznam natáhne znovu
  const { registrations, loading: loadingRegs } = useRaceRegistrations(raceId, successCount);

  useEffect(() => {
    const fetchRace = async () => {
      setLoading(true);
      try {
        const data = await fetch(`/races/${raceId}`).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });
        setRace(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRace();
  }, [raceId]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
      </div>
    );
  }

  if (error || !race) {
    return (
      <div>
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Závod nenalezen.
        </div>
        <Link to="/zavody" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>Zpět na závody
        </Link>
      </div>
    );
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isPast = new Date(race.datum) < today;

  return (
    <>

          {/* Back link */}
          <div className="mb-3">
            <Link to="/zavody" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}>
              <i className="bi bi-arrow-left me-1"></i>Zpět na závody
            </Link>
          </div>

          {/* ===== RACE INFO ===== */}
          <div className="card mb-4" style={{
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
                <i className="bi bi-flag-fill me-2"></i>
                {fixEncoding(race.areal_name) || 'Detail závodu'}
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-8">
                  <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-calendar-event" style={{ color: 'var(--sunset-orange)', fontSize: '1.1rem' }}></i>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.1rem' }}>
                        {formatDate(race.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    {race.organizer_name && (
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-building" style={{ color: 'var(--sunset-orange)' }}></i>
                        <span style={{ color: 'var(--text-secondary)' }}>{fixEncoding(race.organizer_name)}</span>
                      </div>
                    )}
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '1.1rem' }}>{race.race_method_id === 1 ? '❄️' : '🌲'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {race.race_method_id === 1 ? 'Závod na sněhu' : 'Suchý závod'}
                      </span>
                    </div>
                    <div>
                      <span className={`badge fs-6 ${isPast ? 'bg-secondary' : (race.registration ? 'bg-success' : 'bg-danger')}`}>
                        {isPast ? 'Ukončen' : (race.registration ? 'Registrace otevřena' : 'Registrace uzavřena')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="col-md-4">
                  <div className="d-flex flex-column gap-2">
                    <a
                      href={race.proposition_file_id ? `${API_BASE}/races/${race.id}/proposition` : '#'}
                      target={race.proposition_file_id ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="btn"
                      style={race.proposition_file_id ? {
                        background: 'rgba(255,107,0,0.15)',
                        color: 'var(--sunset-orange)',
                        border: '1px solid var(--sunset-orange)'
                      } : {
                        pointerEvents: 'none', opacity: 0.4,
                        background: 'rgba(100,100,100,0.1)',
                        color: '#999',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                      onClick={race.proposition_file_id ? undefined : e => e.preventDefault()}
                    >
                      <i className="bi bi-file-earmark-text me-2"></i>
                      Propozice
                    </a>
                    <a
                      href={race.results_file_id ? `${API_BASE}/races/${race.id}/results` : '#'}
                      target={race.results_file_id ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="btn"
                      style={race.results_file_id ? {
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
                        border: '1px solid #10b981'
                      } : {
                        pointerEvents: 'none', opacity: 0.4,
                        background: 'rgba(100,100,100,0.1)',
                        color: '#999',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                      onClick={race.results_file_id ? undefined : e => e.preventDefault()}
                    >
                      <i className="bi bi-file-earmark-check me-2"></i>
                      Výsledky
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== REGISTRATION FORM (only if open) ===== */}
          {!isPast && race.registration && (
            <div className="mb-4">
              {successMsg && (
                <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  {successMsg}
                  <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
                </div>
              )}
              <RegistrationForm
                raceId={parseInt(raceId)}
                onSuccess={(result) => {
                  setSuccessCount(c => c + 1);
                  setSuccessMsg(result?.message || 'Registrace proběhla úspěšně!');
                }}
              />
            </div>
          )}

          {/* ===== REGISTERED RACERS TABLE ===== */}
      <RegisteredRacersCard registrations={registrations} loading={loadingRegs} />
    </>
  );
}
