import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import API from '../../config/api.js'

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function Archive() {
  const [races, setRaces] = useState([])
  const [seasonResults, setSeasonResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(null)

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

  // Seskupení závodů podle sezón (všechny sezóny včetně aktuální)
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
      allSeasons: sortedSeasons,
      groups: groups
    }
  }, [races])

  // Nastavit první sezónu jako výchozí při načtení
  useEffect(() => {
    if (groupedRaces.allSeasons.length > 0 && !selectedSeason) {
      setSelectedSeason(groupedRaces.allSeasons[0])
    }
  }, [groupedRaces.allSeasons, selectedSeason])

  const getSeasonDisplayName = (season) => {
    const year = season.replace('JMLP', '')
    const yearNum = parseInt(year)
    return `${year}/${(yearNum+1).toString().slice(-2)}`
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
      <div className="card-header bg-primary text-white">
        <h5 className="card-title mb-0">
          <i className="bi bi-trophy me-2"></i>
          Výsledky závodů
        </h5>
      </div>
      <div className="card-body">
        {groupedRaces.allSeasons.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-inbox display-1"></i>
            <p className="mt-2">Zatím nejsou k dispozici žádné závody</p>
          </div>
        ) : (
          <>
            {/* Seznam sezón */}
            <div className="mb-4 pb-3 border-bottom">
              <div className="d-flex flex-wrap gap-2">
                {groupedRaces.allSeasons.map((season) => (
                  <button
                    key={season}
                    className={`btn ${selectedSeason === season ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setSelectedSeason(season)}
                  >
                    {getSeasonDisplayName(season)}
                  </button>
                ))}
              </div>
            </div>

            {/* Vybraná sezóna */}
            {selectedSeason && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">
                    <i className="bi bi-calendar3 me-2"></i>
                    Sezóna: {getSeasonDisplayName(selectedSeason)}
                  </h5>
                  {seasonResults[selectedSeason] && (
                    <a
                      href={`${API_BASE}${seasonResults[selectedSeason].document_file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success"
                      title={seasonResults[selectedSeason].final_results === 1 ? "Stáhnout celkové výsledky" : "Stáhnout průběžné výsledky"}
                    >
                      <i className="bi bi-trophy-fill me-2"></i>
                      {seasonResults[selectedSeason].final_results === 1 ? 'Celkové výsledky' : 'Průběžné výsledky'}
                    </a>
                  )}
                </div>

                {/* Tabulka závodů */}
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Datum</th>
                        <th>Pořadatel</th>
                        <th>Typ</th>
                        <th className="text-end">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRaces.groups[selectedSeason]?.map(race => (
                        <tr key={race.id}>
                          <td>
                            <strong>{race.datum}</strong>
                            <br />
                            <small className="text-muted">{race.areal_name}</small>
                          </td>
                          <td>{race.organizer_name}</td>
                          <td className="text-center">
                            <span title={race.raceMethod_id === 2 ? 'Suchý závod' : 'Závod na sněhu'} style={{fontSize: '1.5rem'}}>
                              {race.raceMethod_id === 2 ? '🌲' : '❄️'}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              {race.proposition_file_path && (
                                <a
                                  href={`${API_BASE}${race.proposition_file_path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-outline-danger"
                                  title="Stáhnout propozice"
                                >
                                  <i className="bi bi-download me-1"></i>
                                  Propozice
                                </a>
                              )}
                              {race.results_file_path && (
                                <a
                                  href={`${API_BASE}${race.results_file_path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-outline-success"
                                  title="Stáhnout výsledky"
                                >
                                  <i className="bi bi-download me-1"></i>
                                  Výsledky
                                </a>
                              )}
                              <Link 
                                to={`/zavod/${race.id}`}
                                className="btn btn-sm btn-primary"
                              >
                                {race.registration ? (
                                  <>
                                    <i className="bi bi-pencil-square me-1"></i>
                                    Registrace
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-info-circle me-1"></i>
                                    Detail
                                  </>
                                )}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}