import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import RegistrationForm from '../ui/RegistrationForm.jsx'
import SearchableSelect from '../ui/SearchableSelect.jsx'
import { formatDate } from '../../utils/date.js'

// API base URL for document links
const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function RaceDetail() {
  const { id } = useParams()
  const raceId = parseInt(id)
  
  const [race, setRace] = useState(null)
  const [clubStats, setClubStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filtry
  const [filterClub, setFilterClub] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/races/${raceId}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json()
      }),
      fetch(`/races/${raceId}/registrations`).then(r => {
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

  // Filtrované data
  const filteredData = useMemo(() => {
    if (!clubStats || !clubStats.clubs) return { clubs: [], total_racers: 0 };
    
    let filteredClubs = clubStats.clubs.map(club => ({
      ...club,
      racers: club.racers.filter(racer => {
        // Filtr podle kategorie
        if (filterCategory && racer.category_id !== parseInt(filterCategory)) {
          return false;
        }
        return true;
      })
    }));
    
    // Filtr podle klubu
    if (filterClub) {
      filteredClubs = filteredClubs.filter(club => 
        club.club_name === filterClub
      );
    }
    
    // Odstraníme kluby bez závodníků po filtrování
    filteredClubs = filteredClubs.filter(club => club.racers.length > 0);
    
    // Přepočítáme celkový počet
    const total = filteredClubs.reduce((sum, club) => sum + club.racers.length, 0);
    
    return { clubs: filteredClubs, total_racers: total };
  }, [clubStats, filterClub, filterCategory]);

  // Resetovat filtry
  const resetFilters = () => {
    setFilterClub('');
    setFilterCategory('');
  };

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
          to="/registrace" 
          className="btn btn-outline-primary text-decoration-none"
        >
          <i className="bi bi-arrow-left me-2"></i>
          Zpět na termínovku
        </Link>
      </div>
      
      <div className="row g-4">
        {/* Race Info Card */}
        <div className="col-12">
          <div className="card" style={{
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
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
                <span className="bi bi-info-circle me-2"></span>
                Detail závodu
              </h5>
            </div>
            <div className="card-body" style={{ padding: '2rem' }}>
              <div className="row align-items-center">
                <div className="col-md-8">
                  {/* Areál - výraznější */}
                  <div className="mb-3">
                    <h2 className="mb-2" style={{
                      color: 'var(--text-primary)',
                      fontSize: '2rem',
                      fontWeight: '600',
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      <span className="bi bi-flag-fill me-3" style={{ color: 'var(--sunset-orange)' }}></span>
                      {race.areal_name || 'Závod'}
                    </h2>
                  </div>
                  
                  {/* Datum - větší a výraznější */}
                  <div className="d-flex align-items-center mb-3">
                    <span className="bi bi-calendar-event" style={{
                      fontSize: '1.5rem',
                      color: 'var(--sunset-orange)',
                      marginRight: '1rem'
                    }}></span>
                    <span style={{
                      fontSize: '1.4rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)'
                    }}>
                      {formatDate(race.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  
                  {/* Typ závodu */}
                  {race.raceMethod_id && (
                    <div className="d-flex align-items-center">
                      <span style={{
                        fontSize: '1.5rem',
                        marginRight: '1rem'
                      }}>
                        {race.raceMethod_id === 1 ? '❄️' : '🌲'}
                      </span>
                      <span style={{
                        fontSize: '1.1rem',
                        fontWeight: '500',
                        color: 'var(--text-primary)'
                      }}>
                        {race.raceMethod_id === 1 ? 'Závod na sněhu' : 'Suchý závod'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="col-md-4">
                <div className="text-end">
                  <span className={`badge fs-6 ${race.registration ? 'bg-success' : 'bg-danger'}`}>
                    <span className={`bi ${race.registration ? 'bi-check-circle' : 'bi-x-circle'}`}></span>
                    Registrace {race.registration ? 'otevřena' : 'uzavřena'}
                  </span>
                </div>
                
                {/* Tlačítka pro dokumenty */}
                <div className="mt-3 p-3 rounded" style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <a
                    href={race.proposition_file_id ? `${API_BASE}/races/${raceId}/proposition` : '#'}
                    target={race.proposition_file_id ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className="btn w-100 mb-2"
                    style={race.proposition_file_id ? {
                      background: 'rgba(255, 107, 0, 0.2)',
                      color: 'var(--sunset-orange)',
                      border: '1px solid var(--sunset-orange)'
                    } : {
                      pointerEvents: 'none',
                      opacity: 0.4,
                      background: 'rgba(100, 100, 100, 0.2)',
                      color: '#999',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    onClick={race.proposition_file_id ? undefined : (e) => e.preventDefault()}
                  >
                    <span className="bi bi-file-earmark-text me-1"></span>
                    Propozice
                  </a>
                  
                  <a
                    href={race.results_file_id ? `${API_BASE}/races/${raceId}/results` : '#'}
                    target={race.results_file_id ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className="btn w-100"
                    style={race.results_file_id ? {
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid #10b981'
                    } : {
                      pointerEvents: 'none',
                      opacity: 0.4,
                      background: 'rgba(100, 100, 100, 0.2)',
                      color: '#999',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
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
          <RegistrationForm raceId={raceId} onSuccess={load} />
        </div>
      )}

      {/* Seznam registrovaných závodníků */}
      <div className="col-12">
        <div className="card" style={{
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
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
              <>
                {/* Filtry */}
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label text-muted small">
                      <i className="bi bi-building me-1"></i>
                      Filtr podle klubu
                    </label>
                    <SearchableSelect
                      options={clubStats.clubs.map(club => ({
                        value: club.club_name,
                        label: `${club.club_name} (${club.racer_count})`
                      }))}
                      value={filterClub}
                      onChange={setFilterClub}
                      placeholder="Všechny kluby"
                      allLabel="Všechny kluby"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label text-muted small">
                      <i className="bi bi-tag me-1"></i>
                      Filtr podle kategorie
                    </label>
                    <SearchableSelect
                      options={(clubStats.categories || []).map(cat => ({
                        value: String(cat.id),
                        label: cat.name
                      }))}
                      value={filterCategory}
                      onChange={setFilterCategory}
                      placeholder="Všechny kategorie"
                      allLabel="Všechny kategorie"
                    />
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    {(filterClub || filterCategory) && (
                      <button
                        className="btn btn-outline-secondary"
                        onClick={resetFilters}
                      >
                        <i className="bi bi-x-circle me-1"></i>
                        Zrušit filtry
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Info o filtrovaných výsledcích */}
                {(filterClub || filterCategory) && (
                  <div className="alert alert-info mb-3 py-2">
                    <i className="bi bi-funnel me-2"></i>
                    Zobrazeno {filteredData.total_racers} z {clubStats.total_racers} závodníků
                  </div>
                )}

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
                      {filteredData.clubs.flatMap(club =>
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
                              {racer.category_name ? (
                                <span className="badge bg-info">{racer.category_name}</span>
                              ) : '-'}
                            </td>
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
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
