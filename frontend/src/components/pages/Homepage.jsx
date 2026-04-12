import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding, formatText } from '../../utils/text.js';
import { formatDate } from '../../utils/date.js';
import jmlpLogo from '../../assets/images/jmlp_logo.png';
import slcrLogo from '../../assets/images/czech_ski_snowboard-logo.png';
import { useLiveStatus } from '../../contexts/LiveStatusContext.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Homepage() {
  const liveRace = useLiveStatus();
  const [posts, setPosts] = useState([]);
  const [upcomingRaces, setUpcomingRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPosts();
    fetchUpcomingRaces();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await API.get(API_CONFIG.ENDPOINTS.POSTS, { limit: 3 });
      setPosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingRaces = async () => {
    try {
      const allRaces = await API.get(API_CONFIG.ENDPOINTS.RACES, {
        current_season: true
      });

      const fixedRaces = allRaces.map(race => ({
        ...race,
        areal_name: fixEncoding(race.areal_name),
        organizer_name: fixEncoding(race.organizer_name)
      }));

      const sorted = fixedRaces.sort((a, b) => {
        if (a.registration && !b.registration) return -1;
        if (!a.registration && b.registration) return 1;
        return new Date(b.datum) - new Date(a.datum);
      });

      setUpcomingRaces(sorted.slice(0, 8));
    } catch (err) {
      console.error('Chyba při načítání závodů:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Načítám...</span>
        </div>
        <p className="mt-2 text-muted">Načítám aktuality...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
        Chyba: {error}
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group races by month for timeline display
  const groupedRaces = upcomingRaces.reduce((groups, race) => {
    const date = new Date(race.datum);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    if (!groups[monthKey]) {
      const monthLabel = date.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
      groups[monthKey] = {
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        races: []
      };
    }
    groups[monthKey].races.push(race);
    return groups;
  }, {});

  return (
    <div>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        .race-timeline-item {
          transition: background 0.15s ease;
        }
        .race-timeline-item:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        .post-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .post-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.25) !important;
        }
      `}</style>

      {/* ===== HERO BANNER ===== */}
      <div style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(10,15,30,0.95) 0%, rgba(20,30,55,0.92) 100%)',
        marginTop: 'calc(-1 * var(--spacing-xl))',
        marginBottom: '2rem'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: '1.5rem',
          padding: '1rem 2rem', width: '100%', maxWidth: '900px'
        }}>
          <img
            src={jmlpLogo}
            alt="JMLP Logo"
            style={{ height: '90px', flexShrink: 0, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))' }}
          />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1
              className="text-white fw-bold mb-1"
              style={{
                fontSize: 'clamp(1.3rem, 3.5vw, 2.2rem)',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                letterSpacing: '-0.01em'
              }}
            >
              Jihomoravský Lyžařský Pohár
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)', margin: 0 }}>
              Seriál závodů alpského lyžování pro všechny kategorie
            </p>
          </div>
          <img
            src={slcrLogo}
            alt="Czech Ski & Snowboard Logo"
            style={{ height: '90px', flexShrink: 0, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))' }}
          />
        </div>
      </div>

      <div className="content-wrapper">
        <div className="row justify-content-center">
          <div className="col-lg-10">

            {/* ===== LIVE ALERT ===== */}
            {liveRace && (
              <Link to="/livetiming" className="text-decoration-none d-block mb-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 4px 20px rgba(231,76,60,0.4)'
                }}>
                  <div className="d-flex align-items-center gap-3">
                    <span style={{
                      width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
                      background: '#fff', boxShadow: '0 0 10px #fff',
                      animation: 'livePulse 1.2s ease-in-out infinite'
                    }} />
                    <div>
                      <div className="fw-bold text-white" style={{ fontSize: '0.95rem' }}>
                        🏁 Právě probíhá závod — {liveRace.areal_name}
                      </div>
                      <small className="text-white-50">Klikněte pro živé výsledky</small>
                    </div>
                  </div>
                  <span className="text-white fw-semibold" style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    Živé výsledky <i className="bi bi-arrow-right ms-1"></i>
                  </span>
                </div>
              </Link>
            )}

            {/* ===== TWO-COLUMN LAYOUT ===== */}
            <div className="row g-4 g-lg-5">

              {/* LEFT COLUMN: Aktuality */}
              <div className="col-12 col-md-7 order-2 order-md-1">
                <div className="mb-3" style={{ borderBottom: '2px solid rgba(255,107,0,0.3)', paddingBottom: '0.75rem' }}>
                  <h2 className="mb-0" style={{ fontSize: '1.5rem', fontWeight: '500', color: 'var(--text-primary)', opacity: '0.9' }}>
                    <span className="bi bi-newspaper me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }}></span>
                    Aktuality
                  </h2>
                </div>

                {posts.length === 0 ? (
                  <div className="alert alert-info">
                    <span className="bi bi-info-circle me-2"></span>
                    Zatím nejsou k dispozici žádné aktuality.
                  </div>
                ) : (
                  <>
                    <div className="d-flex flex-column gap-3">
                      {posts.map(post => {
                        const imgPos = post.image_position || 'left';
                        const showImage = post.image_file_id && imgPos !== 'none';
                        const imageUrl = showImage ? API.getImageUrl(post.id, post.updated_at) : null;
                        const isTop = imgPos === 'top';
                        const isRight = imgPos === 'right';
                        return (
                          <div
                            key={post.id}
                            className={`post-card ${isTop ? 'd-flex flex-column' : 'd-flex'}`}
                            style={{
                              borderRadius: '12px',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'var(--glass-bg)',
                              backdropFilter: 'blur(10px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              overflow: 'hidden'
                            }}
                          >
                            {showImage && !isRight && (
                              isTop
                                ? <div style={{ width: '100%', height: '200px', flexShrink: 0, overflow: 'hidden' }}>
                                    <img src={imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                  </div>
                                : <div style={{ flexShrink: 0, padding: '10px 0 10px 10px', alignSelf: 'center' }}>
                                    <div style={{ width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden' }}>
                                      <img src={imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    </div>
                                  </div>
                            )}
                            <div className="d-flex flex-column p-3" style={{ flex: 1, minWidth: 0 }}>
                              <div className="mb-1">
                                <span className="badge bg-secondary" style={{ fontSize: '0.72rem' }}>
                                  <i className="bi bi-calendar3 me-1"></i>
                                  {formatDate(post.created_at)}
                                </span>
                              </div>
                              <h5 className="fw-bold mb-1" style={{
                                color: 'var(--text-primary)',
                                fontSize: '0.975rem',
                                lineHeight: '1.3'
                              }}>
                                {post.title}
                              </h5>
                              <div
                                style={{
                                  fontSize: '0.875rem',
                                  color: 'var(--text-secondary)'
                                }}
                                dangerouslySetInnerHTML={{ __html: `<p class="mb-0">${formatText(post.content)}</p>` }}
                              />
                              {post.document_file_id && (
                                <div className="mt-2">
                                  <a
                                    href={API.getDocumentUrl(post.id)}
                                    className="btn btn-sm btn-outline-primary"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ borderRadius: '6px', fontWeight: '500' }}
                                  >
                                    <span className="bi bi-file-text me-1"></span>
                                    Stáhnout přílohu
                                  </a>
                                </div>
                              )}
                            </div>
                            {showImage && isRight && (
                              <div style={{ flexShrink: 0, padding: '10px 10px 10px 0', alignSelf: 'center' }}>
                                <div style={{ width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden' }}>
                                  <img src={imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center mt-4">
                      <Link
                        to="/archiv-zprav"
                        className="btn btn-outline-secondary"
                        style={{ borderRadius: '8px', padding: '0.75rem 2rem', fontWeight: '500' }}
                      >
                        <span className="bi bi-arrow-right me-2"></span>
                        Zobrazit starší zprávy
                      </Link>
                    </div>
                  </>
                )}
              </div>

              {/* RIGHT COLUMN: Závody (sticky timeline) */}
              <div className="col-12 col-md-5 order-1 order-md-2">
                <div style={{ position: 'sticky', top: '80px' }}>
                  <div className="mb-3" style={{ borderBottom: '2px solid rgba(255,107,0,0.3)', paddingBottom: '0.75rem' }}>
                    <h2 className="mb-0" style={{ fontSize: '1.5rem', fontWeight: '500', color: 'var(--text-primary)', opacity: '0.9' }}>
                      <span className="bi bi-calendar-event me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }}></span>
                      Závody sezóny
                    </h2>
                  </div>

                  {upcomingRaces.length === 0 ? (
                    <div className="alert alert-info">
                      <span className="bi bi-info-circle me-2"></span>
                      Žádné závody v této sezóně.
                    </div>
                  ) : (
                    <>
                      <div style={{
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(10px)',
                        overflow: 'hidden'
                      }}>
                        {Object.entries(groupedRaces).map(([monthKey, { label, races }], groupIdx) => (
                          <div key={monthKey}>
                            {/* Month header */}
                            <div style={{
                              padding: '0.45rem 1rem',
                              background: 'rgba(255,107,0,0.12)',
                              borderTop: groupIdx > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none'
                            }}>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: '700',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: 'var(--sunset-orange)'
                              }}>
                                {label}
                              </span>
                            </div>

                            {/* Races in this month */}
                            {races.map((race, idx) => {
                              const isPast = new Date(race.datum) < today;
                              const raceDate = new Date(race.datum);
                              return (
                                <div
                                  key={race.id}
                                  className="race-timeline-item d-flex align-items-center gap-3"
                                  style={{
                                    padding: '0.7rem 1rem',
                                    borderTop: '1px solid rgba(255,255,255,0.06)'
                                  }}
                                >
                                  {/* Day number */}
                                  <div style={{ minWidth: '32px', textAlign: 'center', flexShrink: 0 }}>
                                    <span style={{
                                      fontSize: '1.35rem',
                                      fontWeight: '700',
                                      lineHeight: 1,
                                      color: isPast ? 'var(--text-muted)' : 'var(--text-primary)'
                                    }}>
                                      {String(raceDate.getDate()).padStart(2, '0')}
                                    </span>
                                  </div>

                                  {/* Race info */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                      <span style={{ fontSize: '0.9rem' }} title={race.race_method_id === 1 ? 'Závod na sněhu' : 'Suchý závod'}>
                                        {race.race_method_id === 1 ? '❄️' : '🌲'}
                                      </span>
                                      <span className="text-truncate" style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: isPast ? 'var(--text-muted)' : 'var(--text-primary)'
                                      }}>
                                        {race.areal_name || 'Závod'}
                                      </span>
                                    </div>
                                    <div>
                                      {isPast ? (
                                        <span className="badge bg-secondary" style={{ fontSize: '0.68rem' }}>Ukončen</span>
                                      ) : (
                                        <span
                                          className={`badge ${race.registration ? 'bg-success' : 'bg-danger'}`}
                                          style={{ fontSize: '0.68rem' }}
                                        >
                                          {race.registration ? 'Registrace otevřena' : 'Uzavřeno'}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action button */}
                                  <Link
                                    to={!isPast && race.registration ? `/zavod/${race.id}` : (isPast ? `/zavod/${race.id}` : '/zavody')}
                                    className={`btn btn-sm flex-shrink-0 ${isPast ? 'btn-outline-secondary' : 'btn-primary'}`}
                                    style={{ borderRadius: '6px' }}
                                  >
                                    <i className={`bi ${isPast ? 'bi-trophy' : (race.registration ? 'bi-pencil-square' : 'bi-info-circle')} me-1`} style={{ fontSize: '0.8rem' }}></i>
                                    {isPast ? 'Výsledky' : (race.registration ? 'Registrace' : 'Detail')}
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <div className="text-center mt-3">
                        <Link
                          to="/zavody"
                          className="btn btn-outline-secondary btn-sm"
                          style={{ borderRadius: '8px', padding: '0.5rem 1.5rem', fontWeight: '500' }}
                        >
                          <span className="bi bi-arrow-right me-2"></span>
                          Všechny závody
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Homepage;
