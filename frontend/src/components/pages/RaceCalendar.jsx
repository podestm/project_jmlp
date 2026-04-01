import React, { useState, useEffect, useMemo } from 'react';
import RegistrationForm from '../ui/RegistrationForm.jsx';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import { formatDate } from '../../utils/date.js';
import { fixEncoding } from '../../utils/text.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function RaceCalendar() {
  // --- List-level state ---
  const [races, setRaces] = useState([]);
  const [seasonResults, setSeasonResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

  // --- Modal-level state ---
  const [showModal, setShowModal] = useState(false);
  const [selectedRace, setSelectedRace] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalRegistrations, setModalRegistrations] = useState(null);
  const [filterClub, setFilterClub] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // --- Initial data load ---
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

  // --- Season grouping ---
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

  // --- Modal actions ---
  const openModal = async (raceId) => {
    setShowModal(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedRace(null);
    setModalRegistrations(null);
    setFilterClub('');
    setFilterCategory('');

    try {
      const [raceDetail, registrations] = await Promise.all([
        fetch(`/races/${raceId}`).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }),
        fetch(`/races/${raceId}/registrations`).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      ]);
      setSelectedRace(raceDetail);
      setModalRegistrations(registrations);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRace(null);
    setModalRegistrations(null);
    setFilterClub('');
    setFilterCategory('');
  };

  const handleRegistrationSuccess = async () => {
    if (!selectedRace) return;
    try {
      const [updatedRace, updatedRegistrations] = await Promise.all([
        fetch(`/races/${selectedRace.id}`).then(r => r.json()),
        fetch(`/races/${selectedRace.id}/registrations`).then(r => r.json())
      ]);
      setSelectedRace(updatedRace);
      setModalRegistrations(updatedRegistrations);
    } catch (err) {
      console.error('Failed to refresh registrations:', err);
    }
  };

  // --- Filtered registrations (modal) ---
  const filteredModalData = useMemo(() => {
    if (!modalRegistrations?.clubs) return { clubs: [], total_racers: 0 };

    let filteredClubs = modalRegistrations.clubs.map(club => ({
      ...club,
      racers: club.racers.filter(racer => {
        if (filterCategory && racer.category_id !== parseInt(filterCategory)) return false;
        return true;
      })
    }));

    if (filterClub) {
      filteredClubs = filteredClubs.filter(club => club.club_name === filterClub);
    }

    filteredClubs = filteredClubs.filter(club => club.racers.length > 0);
    const total = filteredClubs.reduce((sum, club) => sum + club.racers.length, 0);
    return { clubs: filteredClubs, total_racers: total };
  }, [modalRegistrations, filterClub, filterCategory]);

  // --- Loading / error states ---
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
    <div>
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
                  {/* Season header + result download */}
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

                  {/* Races table */}
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
                              onClick={() => openModal(race.id)}
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
                                  {race.proposition_file_path && (
                                    <a
                                      href={`${API_BASE}/${race.proposition_file_path}`}
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
                                  {race.results_file_path && (
                                    <a
                                      href={`${API_BASE}/${race.results_file_path}`}
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
                                  {!isPast && race.registration ? (
                                    <button
                                      className="btn btn-sm btn-primary"
                                      onClick={e => { e.stopPropagation(); openModal(race.id); }}
                                    >
                                      <i className="bi bi-pencil-square me-1"></i>
                                      Registrovat
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={e => { e.stopPropagation(); openModal(race.id); }}
                                    >
                                      <i className="bi bi-info-circle me-1"></i>
                                      Detail
                                    </button>
                                  )}
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

      {/* ===== MODAL ===== */}
      {showModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={closeModal}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-fullscreen-sm-down"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-content" style={{
              background: 'var(--glass-bg)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)'
            }}>

              {/* Modal Header */}
              <div className="modal-header" style={{
                background: 'linear-gradient(135deg, var(--sunset-orange) 0%, #e65a00 100%)',
                color: 'white',
                borderBottom: 'none'
              }}>
                <h5 className="modal-title">
                  <i className="bi bi-info-circle me-2"></i>
                  {modalLoading ? 'Načítám...' : (selectedRace ? fixEncoding(selectedRace.areal_name) : 'Detail závodu')}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body" style={{ color: 'var(--text-primary)', padding: '1.5rem' }}>

                {modalLoading && (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Načítám...</span>
                    </div>
                    <p className="mt-2 text-muted">Načítám detail závodu...</p>
                  </div>
                )}

                {modalError && (
                  <div className="alert alert-danger" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    Chyba při načítání: {modalError}
                  </div>
                )}

                {!modalLoading && !modalError && selectedRace && (
                  <>
                    {/* Race info */}
                    <div className="row mb-4">
                      <div className="col-md-8">
                        <h2 className="mb-3" style={{
                          color: 'var(--text-primary)',
                          fontSize: '1.8rem',
                          fontWeight: '600',
                          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          <span className="bi bi-flag-fill me-3" style={{ color: 'var(--sunset-orange)' }}></span>
                          {fixEncoding(selectedRace.areal_name) || 'Závod'}
                        </h2>

                        <div className="d-flex align-items-center mb-3">
                          <span className="bi bi-calendar-event" style={{
                            fontSize: '1.4rem',
                            color: 'var(--sunset-orange)',
                            marginRight: '1rem'
                          }}></span>
                          <span style={{ fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {formatDate(selectedRace.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        </div>

                        {selectedRace.race_method_id && (
                          <div className="d-flex align-items-center">
                            <span style={{ fontSize: '1.4rem', marginRight: '1rem' }}>
                              {selectedRace.race_method_id === 1 ? '❄️' : '🌲'}
                            </span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                              {selectedRace.race_method_id === 1 ? 'Závod na sněhu' : 'Suchý závod'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="col-md-4">
                        <div className="text-md-end mb-3">
                          <span className={`badge fs-6 ${selectedRace.registration ? 'bg-success' : 'bg-danger'}`}>
                            <span className={`bi ${selectedRace.registration ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></span>
                            Registrace {selectedRace.registration ? 'otevřena' : 'uzavřena'}
                          </span>
                        </div>

                        <div className="p-3 rounded" style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <a
                            href={selectedRace.proposition_file_id ? `${API_BASE}/races/${selectedRace.id}/proposition` : '#'}
                            target={selectedRace.proposition_file_id ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            className="btn w-100 mb-2"
                            style={selectedRace.proposition_file_id ? {
                              background: 'rgba(255, 107, 0, 0.2)',
                              color: 'var(--sunset-orange)',
                              border: '1px solid var(--sunset-orange)'
                            } : {
                              pointerEvents: 'none',
                              opacity: 0.4,
                              background: 'rgba(100,100,100,0.2)',
                              color: '#999',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                            onClick={selectedRace.proposition_file_id ? undefined : e => e.preventDefault()}
                          >
                            <span className="bi bi-file-earmark-text me-1"></span>
                            Propozice
                          </a>

                          <a
                            href={selectedRace.results_file_id ? `${API_BASE}/races/${selectedRace.id}/results` : '#'}
                            target={selectedRace.results_file_id ? '_blank' : '_self'}
                            rel="noopener noreferrer"
                            className="btn w-100"
                            style={selectedRace.results_file_id ? {
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#10b981',
                              border: '1px solid #10b981'
                            } : {
                              pointerEvents: 'none',
                              opacity: 0.4,
                              background: 'rgba(100,100,100,0.2)',
                              color: '#999',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                            onClick={selectedRace.results_file_id ? undefined : e => e.preventDefault()}
                          >
                            <span className="bi bi-file-earmark-check me-1"></span>
                            Výsledky
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Registration form */}
                    {selectedRace.registration && (
                      <div className="mb-4">
                        <RegistrationForm
                          raceId={selectedRace.id}
                          onSuccess={handleRegistrationSuccess}
                        />
                      </div>
                    )}

                    {/* Registrations list */}
                    <div className="card" style={{
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
                          Seznam registrovaných závodníků ({modalRegistrations?.total_racers || 0})
                        </h5>
                      </div>
                      <div className="card-body">
                        {!modalRegistrations || modalRegistrations.total_racers === 0 ? (
                          <div className="text-center text-muted py-3">
                            <span className="bi bi-person-x" style={{ fontSize: '3rem' }}></span>
                            <p className="mt-2">Zatím není nikdo přihlášen</p>
                          </div>
                        ) : (
                          <>
                            {/* Filters */}
                            <div className="row g-3 mb-4">
                              <div className="col-md-4">
                                <label className="form-label text-muted small">
                                  <i className="bi bi-building me-1"></i>
                                  Filtr podle klubu
                                </label>
                                <SearchableSelect
                                  options={modalRegistrations.clubs.map(club => ({
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
                                  options={(modalRegistrations.categories || []).map(cat => ({
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
                                    onClick={() => { setFilterClub(''); setFilterCategory(''); }}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>
                                    Zrušit filtry
                                  </button>
                                )}
                              </div>
                            </div>

                            {(filterClub || filterCategory) && (
                              <div className="alert alert-info mb-3 py-2">
                                <i className="bi bi-funnel me-2"></i>
                                Zobrazeno {filteredModalData.total_racers} z {modalRegistrations.total_racers} závodníků
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
                                  {filteredModalData.clubs.flatMap(club =>
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
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
