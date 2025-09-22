import React from 'react'
import RegistrationForm from './RegistrationForm.jsx'
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function RaceDetail({ raceId }) {
  const [race, setRace] = React.useState(null)
  const [clubStats, setClubStats] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${API}/races/${raceId}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json()
      }),
      fetch(`${API}/races/${raceId}/club-stats`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json()
      })
    ]).then(([r, stats]) => {
      setRace(r)
      setClubStats(stats)
      setLoading(false)
    }).catch(err => {
      console.error('Error loading data:', err)
      setError(err.message)
      setLoading(false)
    })
  }, [raceId])

  React.useEffect(() => {
    if (raceId) {
      load()
    }
  }, [load, raceId])

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám detail závodu...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Chyba: {error}
      </div>
    )
  }

  if (!race) {
    return (
      <div className="alert alert-warning" role="alert">
        <i className="bi bi-search me-2"></i>
        Závod nenalezen
      </div>
    )
  }

  return (
    <div className="row g-4">
      {/* Race Info Card */}
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">
              <span className="bi bi-info-circle"></span>
              Detail závodu
            </h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <h4 className="text-primary">
                  <span className="bi bi-flag-fill"></span>
                  {race.areal_name || 'Závod'}
                </h4>
                <p className="mb-2">
                  <span className="bi bi-calendar3"></span>
                  <strong>Datum:</strong> {race.datum}
                </p>
              </div>
              <div className="col-md-6">
                <div className="text-end">
                  <span className={`badge fs-6 ${race.registration ? 'bg-success' : 'bg-danger'}`}>
                    <span className={`bi ${race.registration ? 'bi-check-circle' : 'bi-x-circle'}`}></span>
                    Registrace {race.registration ? 'otevřena' : 'uzavřena'}
                  </span>
                </div>
                
                {/* Tlačítka pro dokumenty */}
                <div className="mt-3 p-3 border rounded bg-light">
                  <a
                    href={race.proposition ? `${API}/races/${raceId}/documents/proposition` : '#'}
                    target={race.proposition ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`btn w-100 mb-2 ${race.proposition ? 'btn-outline-primary' : 'btn-outline-dark'}`}
                    style={race.proposition ? { border: '1px solid #0d6efd' } : { pointerEvents: 'none', opacity: 0.6, border: '1px solid #6c757d' }}
                    onClick={race.proposition ? undefined : (e) => e.preventDefault()}
                  >
                    <span className="bi bi-file-earmark-text me-1"></span>
                    Propozice
                  </a>
                  
                  <a
                    href={race.result ? `${API}/races/${raceId}/documents/result` : '#'}
                    target={race.result ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`btn w-100 ${race.result ? 'btn-outline-success' : 'btn-outline-dark'}`}
                    style={race.result ? { border: '1px solid #198754' } : { pointerEvents: 'none', opacity: 0.6, border: '1px solid #6c757d' }}
                    onClick={race.result ? undefined : (e) => e.preventDefault()}
                  >
                    <span className="bi bi-file-earmark-check me-1"></span>
                    Výsledky
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      {race.registration && (
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <span className="bi bi-person-plus"></span>
                Registrovat závodníka
              </h5>
            </div>
            <div className="card-body">
              <RegistrationForm raceId={raceId} onSuccess={load} />
            </div>
          </div>
        </div>
      )}

      {/* Club Statistics - moved to bottom */}
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">
              <span className="bi bi-people"></span>
              Přihlášení závodníci podle klubů ({clubStats?.total_racers || 0})
            </h5>
          </div>
          <div className="card-body">
            {!clubStats || clubStats.total_racers === 0 ? (
              <div className="text-center text-muted">
                <span className="bi bi-person-x" style={{ fontSize: '3rem' }}></span>
                <p className="mt-2">Zatím není nikdo přihlášen</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {clubStats.clubs.map((club, index) => (
                  <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>
                      <span className="bi bi-building"></span>
                      {club.club_name}
                    </span>
                    <span className="badge bg-primary rounded-pill">
                      {club.racer_count} přihlášených
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
