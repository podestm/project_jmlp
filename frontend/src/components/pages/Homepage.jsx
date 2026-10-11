import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding, formatText } from '../../utils/text.js';
import { formatDate } from '../../utils/date.js';
import jmlpLogo from '../../assets/images/jmlp_logo.png';
import slcrLogo from '../../assets/images/czech_ski_snowboard-logo.png';
import { useLiveStatus } from '../../contexts/LiveStatusContext.jsx';
import { useRevalidateOnFocus } from '../../hooks/useRevalidateOnFocus.js';
import Icon from '../ms/Icon/Icon.jsx';


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

  // silent: obnova na pozadí - bez spinneru a bez chybové hlášky přes obsah,
  // který už na obrazovce je
  const fetchPosts = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const data = await API.get(API_CONFIG.ENDPOINTS.POSTS, { limit: 3 });
      setPosts(data);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
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

  useRevalidateOnFocus(() => {
    fetchPosts({ silent: true });
    fetchUpcomingRaces();
  });

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
        <Icon name="warning" className="me-2" />
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
      <style>{`@layer legacy {
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
      }`}</style>

      <div className="content-wrapper">
        <div className="row justify-content-center">
          <div className="col-lg-10">

            {/*
              Hlavička s názvem a logy - světlý panel podle ostrého webu jmlp.cz.

              Sedí ve stejném sloupci a má stejné zaoblení jako karty aktualit
              pod ním, takže nepůsobí jako cizí blok nalepený nahoru. Rozvržení
              drží flex, ne bootstrapový grid: logo se roztáhne přesně na svou
              šířku a na úzkém displeji se prvky složí pod sebe samy.
            */}
            <div
              className="mb-4"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
                padding: '1.25rem 1.75rem',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '12px',
                borderBottom: '3px solid #4a90e2',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <img
                src={jmlpLogo}
                alt="JMLP Logo"
                style={{ maxHeight: '100px', width: 'auto', flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))' }}
              />
              <div style={{ flex: '1 1 260px', textAlign: 'center', minWidth: 0 }}>
                <h1
                  className="fw-bold mb-1"
                  style={{
                    color: '#2c3e50',
                    fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  Jihomoravský Lyžařský Pohár
                </h1>
                <p className="text-muted mb-0" style={{ fontSize: '1rem' }}>
                  Seriál závodů pro všechny kategorie
                </p>
              </div>
              <img
                src={slcrLogo}
                alt="Czech Ski &amp; Snowboard Logo"
                style={{ maxHeight: '100px', width: 'auto', flexShrink: 0, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))' }}
              />
            </div>

            {/* ===== LIVE ALERT ===== */}
            {liveRace && (
              <Link to="/zive" className="text-decoration-none d-block mb-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
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
                    Živé výsledky <Icon name="arrow-right" className="ms-1" />
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
                    <Icon name="news" className="me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }} />
                    Aktuality
                  </h2>
                </div>

                {posts.length === 0 ? (
                  <div className="alert alert-info">
                    <Icon name="info" className="me-2" />
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
                                  <Icon name="calendar" className="me-1" />
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
                                    <Icon name="file-text" className="me-1" />
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
                        to="/aktuality"
                        className="btn btn-outline-secondary"
                        style={{ borderRadius: '8px', padding: '0.75rem 2rem', fontWeight: '500' }}
                      >
                        <Icon name="arrow-right" className="me-2" />
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
                      <Icon name="calendar" className="me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }} />
                      Závody sezóny
                    </h2>
                  </div>

                  {upcomingRaces.length === 0 ? (
                    <div className="alert alert-info">
                      <Icon name="info" className="me-2" />
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
                            {races.map((race, _idx) => {
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
                                    <Icon name={isPast ? 'trophy' : (race.registration ? 'pencil' : 'info')} className="me-1" style={{ fontSize: '0.8rem' }} />
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
                          <Icon name="arrow-right" className="me-2" />
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
