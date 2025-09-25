import React from 'react'
import { Link } from 'react-router-dom'
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function RaceList({ currentSeason = false }) {
  const [races, setRaces] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    const url = currentSeason ? `${API}/races/?current_season=true` : `${API}/races/`
    fetch(url)
      .then(r => r.json())
      .then(setRaces)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [currentSeason])

  // Seskupení závodů podle sezón
  const groupedRaces = React.useMemo(() => {
    const groups = {}
    races.forEach(race => {
      if (race.raceNr) {
        const season = race.raceNr.substring(0, 8) // např. "JMLP2024"
        if (!groups[season]) {
          groups[season] = []
        }
        groups[season].push(race)
      }
    })
    
    // Seřadíme sezóny sestupně (nejnovější první)
    const sortedSeasons = Object.keys(groups).sort().reverse()
    
    return {
      currentSeason: sortedSeasons[0], // nejnovější sezóna
      currentRaces: groups[sortedSeasons[0]] || [],
      historicalSeasons: sortedSeasons.slice(1),
      historicalGroups: groups
    }
  }, [races])

  const getSeasonDisplayName = (season) => {
    const year = season.replace('JMLP', '')
    const yearNum = parseInt(year)
    return `${year}/${(yearNum+1).toString().slice(-2)}`
  }

  // Pokud chceme pouze aktuální sezónu, zobrazíme jen tu
  if (currentSeason) {
    return (
      <div className="card">
        <div className="card-header bg-primary text-white">
          <h5 className="card-title mb-0">
            <i className="bi bi-calendar-event me-2"></i>
            Termínovka sezóny {groupedRaces.currentSeason ? getSeasonDisplayName(groupedRaces.currentSeason) : ''}
          </h5>
        </div>
        <div className="card-body">
          {groupedRaces.currentRaces.length === 0 ? (
            <div className="text-center text-muted">
              <i className="bi bi-inbox display-1"></i>
              <p className="mt-2">Zatím nejsou k dispozici žádné závody pro aktuální sezónu</p>
            </div>
          ) : (
            <div className="row g-3">
              {groupedRaces.currentRaces.map(race => (
                <div key={race.id} className="col-md-6 col-lg-4">
                  <div className="card h-100 race-card shadow-sm">
                    <div className="card-body d-flex flex-column">
                      <h6 className="card-title text-primary">
                        <i className="bi bi-geo-alt-fill me-2"></i>
                        {race.areal_name}
                      </h6>
                      <p className="card-text mb-2">
                        <i className="bi bi-calendar3 me-2"></i>
                        {race.datum}
                      </p>
                      <p className="card-text mb-2 text-muted">
                        <i className="bi bi-buildings me-2"></i>
                        <small>{race.organizer_name}</small>
                      </p>
                      <div className="mb-3">
                        <span className={`badge ${race.registration ? 'bg-success' : 'bg-danger'}`}>
                          <i className={`bi ${race.registration ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                          Registrace {race.registration ? 'otevřena' : 'uzavřena'}
                        </span>
                      </div>
                      <div className="mt-auto">
                        <Link 
                          to={`/zavod/${race.id}`}
                          className="btn btn-primary w-100 text-decoration-none"
                        >
                          <i className="bi bi-arrow-right-circle me-2"></i>
                          Přejít na závod
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám závody...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Chyba při načítání závodů
      </div>
    )
  }

  return (
    <div>
      {loading && (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Načítám...</span>
          </div>
          <p className="mt-2 text-muted">Načítám závody...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Chyba při načítání závodů
        </div>
      )}

      {!loading && !error && currentSeasonOnly && (
        <div className="card">
          <div className="card-header bg-primary text-white">
            <h5 className="card-title mb-0">
              <i className="bi bi-calendar-event me-2"></i>
              Termínovka sezóny {groupedRaces.currentSeason ? getSeasonDisplayName(groupedRaces.currentSeason) : ''}
            </h5>
          </div>
          <div className="card-body">
            {groupedRaces.currentRaces.length === 0 ? (
              <div className="text-center text-muted">
                <i className="bi bi-inbox display-1"></i>
                <p className="mt-2">Zatím nejsou k dispozici žádné závody pro aktuální sezónu</p>
              </div>
            ) : (
              <div className="row g-3">
                {groupedRaces.currentRaces.map(race => (
                  <div key={race.id} className="col-md-6 col-lg-4">
                    <div className="card h-100 race-card shadow-sm">
                      <div className="card-body d-flex flex-column">
                        <h6 className="card-title text-primary">
                          <i className="bi bi-geo-alt-fill me-2"></i>
                          {race.areal_name}
                        </h6>
                        <p className="card-text mb-2">
                          <i className="bi bi-calendar3 me-2"></i>
                          {race.datum}
                        </p>
                        <p className="card-text mb-2 text-muted">
                          <i className="bi bi-building me-2"></i>
                          <small>{race.organizer_name}</small>
                        </p>
                        <div className="mb-3">
                          <span className={`badge ${race.registration ? 'bg-success' : 'bg-danger'}`}>
                            <i className={`bi ${race.registration ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                            Registrace {race.registration ? 'otevřena' : 'uzavřena'}
                          </span>
                        </div>
                        <div className="mt-auto">
                          <Link 
                            to={`/zavod/${race.id}`}
                            className="btn btn-primary w-100 text-decoration-none"
                          >
                            <i className="bi bi-arrow-right-circle me-2"></i>
                            Přejít na závod
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
