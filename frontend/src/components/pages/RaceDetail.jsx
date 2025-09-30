import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import RegistrationForm from '../ui/RegistrationForm.jsx'
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function RaceDetail() {
  const { id } = useParams()
  const raceId = parseInt(id)
  
  const [race, setRace] = useState(null)
  const [clubStats, setClubStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`${API}/races/${raceId}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json()
      }),
      fetch(`${API}/races/${raceId}/registrations`).then(r => {
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

  useEffect(() => {
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
    <div>
      {/* Back Button */}
      <div className="mb-3">
        <Link 
          to="/terminovka" 
          className="btn btn-outline-primary text-decoration-none"
        >
          <i className="bi bi-arrow-left me-2"></i>
          Zpět na termínovku
        </Link>
      </div>
      
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
                    href={race.proposition_file_id ? `${API}/races/${raceId}/proposition` : '#'}
                    target={race.proposition_file_id ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`btn w-100 mb-2 ${race.proposition_file_id ? 'btn-outline-primary' : 'btn-outline-dark'}`}
                    style={race.proposition_file_id ? { border: '1px solid #0d6efd' } : { pointerEvents: 'none', opacity: 0.6, border: '1px solid #6c757d' }}
                    onClick={race.proposition_file_id ? undefined : (e) => e.preventDefault()}
                  >
                    <span className="bi bi-file-earmark-text me-1"></span>
                    Propozice
                  </a>
                  
                  <a
                    href={race.results_file_id ? `${API}/races/${raceId}/results` : '#'}
                    target={race.results_file_id ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`btn w-100 ${race.results_file_id ? 'btn-outline-success' : 'btn-outline-dark'}`}
                    style={race.results_file_id ? { border: '1px solid #198754' } : { pointerEvents: 'none', opacity: 0.6, border: '1px solid #6c757d' }}
                    onClick={race.results_file_id ? undefined : (e) => e.preventDefault()}
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

      {/* Seznam registrovaných závodníků */}
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">
              <span className="bi bi-people"></span>
              Seznam registrovaných závodníků ({clubStats?.total_racers || 0})
            </h5>
          </div>
          <div className="card-body">
            {!clubStats || clubStats.total_racers === 0 ? (
              <div className="text-center text-muted">
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
                      <th>SLČR ID</th>
                      <th>Klub</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubStats.clubs.flatMap(club =>
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
                          <td className="text-danger">{racer.idSlcr || '-'}</td>
                          <td>
                            <span className="badge bg-secondary">{club.club_name}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
