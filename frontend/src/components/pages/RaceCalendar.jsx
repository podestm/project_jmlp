import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/date.js';
import { fixEncoding } from '../../utils/text.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function RaceCalendar() {
  const [races, setRaces] = useState([]);
  const [seasonResults, setSeasonResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/races/').then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch('/season-results/').then(r => r.json()).catch(() => [])
    ]).then(([raceData, resultData]) => {
      setRaces(raceData);
      const resultMap = {};
      resultData.forEach(result => {
        const seasonKey = `JMLP${result.season_year_start}`;
        resultMap[seasonKey] = result;
      });
      setSeasonResults(resultMap);
    }).catch(err => {
      setError(err.message);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const groupedRaces = useMemo(() => {
    const groups = {};
    races.forEach(race => {
      if (race.race_nr) {
        const season = race.race_nr.substring(0, 8);
        if (!groups[season]) groups[season] = [];
        groups[season].push(race);
      }
    });
    const allSeasons = Object.keys(groups).sort().reverse();
    return { allSeasons, groups };
  }, [races]);

  useEffect(() => {
    if (groupedRaces.allSeasons.length > 0 && !selectedSeason) {
      setSelectedSeason(groupedRaces.allSeasons[0]);
    }
  }, [groupedRaces.allSeasons, selectedSeason]);

  const getSeasonDisplayName = (season) => {
    const year = season.replace('JMLP', '');
    const yearNum = parseInt(year);
    return `${year}/${(yearNum + 1).toString().slice(-2)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám kalendář závodů...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Chyba při načítání závodů: {error}
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
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
          <i className="bi bi-calendar3 me-2"></i>
          Kalendář závodů
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
            {/* Season tabs */}
            <div className="mb-4 pb-3 border-bottom">
              <div
                className="d-flex gap-2"
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  whiteSpace: 'nowrap',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--sunset-orange) rgba(255,255,255,0.1)',
                  paddingBottom: '0.5rem'
                }}
              >
                {groupedRaces.allSeasons.map(season => (
                  <button
                    key={season}
                    className={`btn ${selectedSeason === season ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setSelectedSeason(season)}
                    style={{ flexShrink: 0, minWidth: 'fit-content' }}
                  >
                    {getSeasonDisplayName(season)}
                  </button>
                ))}
              </div>
            </div>

            {selectedSeason && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
                    <i className="bi bi-calendar3 me-2"></i>
                    Sezóna: {getSeasonDisplayName(selectedSeason)}
                  </h5>
                  {seasonResults[selectedSeason] && (
                    <a
                      href={`${API_BASE}/${seasonResults[selectedSeason].document_file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success"
                      title={seasonResults[selectedSeason].final_results === 1 ? 'Stáhnout celkové výsledky' : 'Stáhnout průběžné výsledky'}
                    >
                      <i className="bi bi-trophy-fill me-2"></i>
                      {seasonResults[selectedSeason].final_results === 1 ? 'Celkové výsledky' : 'Průběžné výsledky'}
                    </a>
                  )}
                </div>

                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Datum</th>
                        <th>Pořadatel</th>
                        <th className="text-center">Typ</th>
                        <th className="text-end">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRaces.groups[selectedSeason]?.map(race => {
                        const isPast = new Date(race.datum) < today;
                        return (
                          <tr
                            key={race.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => window.location.href = `/zavod/${race.id}`}
                          >
                            <td>
                              <strong>{formatDate(race.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                              <br />
                              <small className="text-muted">{fixEncoding(race.areal_name)}</small>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>{fixEncoding(race.organizer_name)}</td>
                            <td className="text-center" style={{ verticalAlign: 'middle' }}>
                              <span title={race.race_method_id === 1 ? 'Závod na sněhu' : 'Suchý závod'} style={{ fontSize: '1.1rem' }}>
                                {race.race_method_id === 1 ? '❄️' : '🌲'}
                              </span>
                            </td>
                            <td className="text-end" style={{ verticalAlign: 'middle' }}>
                              <div className="d-flex gap-2 justify-content-end">
                                {/* Dokumenty se stahují přes API endpoint, ne přímo z /uploads -
                                    backend hlídá existenci souboru a vrací původní název přílohy. */}
                                {race.proposition_file_id && (
                                  <a
                                    href={`${API_BASE}/races/${race.id}/proposition`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-secondary"
                                    title="Stáhnout propozice"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <i className="bi bi-download me-1"></i>
                                    Propozice
                                  </a>
                                )}
                                {race.results_file_id && (
                                  <a
                                    href={`${API_BASE}/races/${race.id}/results`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-success"
                                    title="Stáhnout výsledky"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <i className="bi bi-download me-1"></i>
                                    Výsledky
                                  </a>
                                )}
                                {!isPast && race.registration && (
                                  <Link
                                    to={`/zavod/${race.id}`}
                                    className="btn btn-sm btn-primary"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <i className="bi bi-pencil-square me-1"></i>
                                    Registrovat
                                  </Link>
                                )}
                                <Link
                                  to={`/zavod/${race.id}`}
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <i className="bi bi-info-circle me-1"></i>
                                  Detail
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
