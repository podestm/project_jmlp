import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import API from '../../config/api.js'

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Archive() {
  const [races, setRaces] = useState([])
  const [seasonResults, setSeasonResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedSeasons, setExpandedSeasons] = useState(new Set())

  useEffect(() => {
    fetch('/races/')
      .then(r => r.json())
      .then(setRaces)
      .catch(setError)
      .finally(() => setLoading(false))
    
    // Fetch all season results
    fetch('/season-results/')
      .then(r => r.json())
      .then(results => {
        // Create a map of season key to result
        const resultMap = {}
        results.forEach(result => {
          const seasonKey = `JMLP${result.season_year_start}`
          resultMap[seasonKey] = result
        })
        setSeasonResults(resultMap)
      })
      .catch(err => console.debug('Celkové výsledky nejsou dostupné:', err))
  }, [])

  // Seskupení závodů podle sezón (pouze historické)
  const groupedRaces = useMemo(() => {
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
      historicalSeasons: sortedSeasons.slice(1), // přeskočíme aktuální sezónu
      historicalGroups: groups
    }
  }, [races])

  const getSeasonDisplayName = (season) => {
    const year = season.replace('JMLP', '')
    const yearNum = parseInt(year)
    return `${year}/${(yearNum+1).toString().slice(-2)}`
  }

  const toggleSeason = (season) => {
    const newExpanded = new Set(expandedSeasons)
    if (newExpanded.has(season)) {
      newExpanded.delete(season)
    } else {
      newExpanded.add(season)
    }
    setExpandedSeasons(newExpanded)
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám archiv závodů...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Chyba při načítání archivu závodů
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header bg-secondary text-white">
        <h5 className="card-title mb-0">
          <i className="bi bi-archive me-2"></i>
          Archiv závodů
        </h5>
      </div>
      <div className="card-body">
        {groupedRaces.historicalSeasons.length === 0 ? (
          <div className="text-center text-muted">
            <i className="bi bi-inbox display-1"></i>
            <p className="mt-2">Zatím nejsou k dispozici žádné historické závody</p>
          </div>
        ) : (
          <div className="accordion" id="seasonAccordion">
            {groupedRaces.historicalSeasons.map((season, index) => (
              <div key={season} className="accordion-item mb-3">
                <h2 className="accordion-header">
                  <button
                    className={`accordion-button ${!expandedSeasons.has(season) ? 'collapsed' : ''}`}
                    type="button"
                    onClick={() => toggleSeason(season)}
                  >
                    <div className="d-flex justify-content-between align-items-center w-100 me-3">
                      <div className="d-flex align-items-center gap-3">
                        <span>
                          <i className="bi bi-calendar3 me-2"></i>
                          Sezóna {getSeasonDisplayName(season)}
                        </span>
                        {seasonResults[season] && (
                          <a
                            href={`${API_BASE}${seasonResults[season].document_file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-success"
                            onClick={(e) => e.stopPropagation()}
                            title="Stáhnout celkové výsledky"
                          >
                            <i className="bi bi-trophy-fill me-1"></i>
                            Celkové výsledky
                          </a>
                        )}
                      </div>
                      <span className="badge bg-primary rounded-pill">
                        {groupedRaces.historicalGroups[season].length} závodů
                      </span>
                    </div>
                  </button>
                </h2>
                {expandedSeasons.has(season) && (
                  <div className="accordion-body">
                    <div className="row g-3">
                      {groupedRaces.historicalGroups[season].map(race => (
                        <div key={race.id} className="col-md-6 col-lg-4">
                          <div className="card h-100 race-card border-light">
                            <div className="card-body d-flex flex-column">
                              <h6 className="card-title text-muted">
                                <i className="bi bi-geo-alt me-2"></i>
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
                                <span className="badge bg-secondary">
                                  <i className="bi bi-archive me-1"></i>
                                  Archivní závod
                                </span>
                              </div>
                              <div className="mt-auto">
                                <Link 
                                  to={`/zavod/${race.id}`}
                                  className="btn btn-outline-primary w-100 text-decoration-none"
                                >
                                  <i className="bi bi-arrow-right me-2"></i>
                                  Zobrazit detail
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}