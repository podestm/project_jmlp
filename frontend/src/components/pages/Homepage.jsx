import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding, formatText } from '../../utils/text.js';
import { formatDate } from '../../utils/date.js';
import jmlpLogo from '../../assets/images/jmlp_logo.png';
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
      const data = await API.get(API_CONFIG.ENDPOINTS.POSTS, { limit: 6 });
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

  return (
    <div>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>

      {/* ===== HERO BANNER ===== */}
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(10,15,30,0.95) 0%, rgba(20,30,55,0.92) 100%)',
        marginBottom: '2.5rem'
      }}>
        {/* Dark overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)'
        }} />

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: '3.5rem 1.5rem'
        }}>
          <img
            src={jmlpLogo}
            alt="JMLP Logo"
            style={{
              maxHeight: '110px',
              marginBottom: '1.75rem',
              filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))'
            }}
          />
          <h1
            className="text-white fw-bold mb-2"
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.75rem)',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              letterSpacing: '-0.01em'
            }}
          >
            Jihomoravský Lyžařský Pohár
          </h1>
          <p
            style={{
              fontSize: '1.1rem',
              color: 'rgba(255,255,255,0.65)',
              maxWidth: '480px',
              margin: '0 auto'
            }}
          >
            Seriál závodů alpského lyžování pro všechny kategorie
          </p>
        </div>
      </div>

      <div className="content-wrapper">
        <div className="row justify-content-center">
          <div className="col-lg-10">

            {/* Live panel */}
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

            {/* ===== UPCOMING RACES CAROUSEL ===== */}
      {upcomingRaces.length > 0 && (
        <div className="mb-5">
          <div className="mb-3" style={{
            borderBottom: '2px solid rgba(255, 107, 0, 0.3)',
            paddingBottom: '0.75rem'
          }}>
            <h2 className="mb-0" style={{
              fontSize: '1.5rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
              opacity: '0.9'
            }}>
              <span className="bi bi-calendar-event me-2" style={{ color: 'var(--sunset-orange)', opacity: '0.8' }}></span>
              Nadcházející závody
            </h2>
          </div>

          <div
            className="d-flex gap-3 py-2"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--sunset-orange) rgba(255,255,255,0.1)',
              paddingBottom: '0.75rem'
            }}
          >
            {upcomingRaces.map(race => {
              const isPast = new Date(race.datum) < today;
              return (
                <div
                  key={race.id}
                  className="card flex-shrink-0"
                  style={{
                    minWidth: '210px',
                    maxWidth: '240px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  <div className="card-body p-3 d-flex flex-column">
                    <div className="d-flex align-items-center gap-1 mb-2">
                      <span style={{ fontSize: '1.1rem' }} title={race.race_method_id === 1 ? 'Závod na sněhu' : 'Suchý závod'}>
                        {race.race_method_id === 1 ? '❄️' : '🌲'}
                      </span>
                      <h6 className="fw-bold mb-0 text-truncate" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {race.areal_name || 'Závod'}
                      </h6>
                    </div>
                    <small className="text-muted d-block mb-3">
                      <i className="bi bi-calendar3 me-1"></i>
                      {formatDate(race.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </small>
                    <div className="mb-3">
                      {isPast ? (
                        <span className="badge bg-secondary">Ukončen</span>
                      ) : (
                        <span className={`badge ${race.registration ? 'bg-success' : 'bg-danger'}`}>
                          {race.registration ? 'Registrace otevřena' : 'Uzavřeno'}
                        </span>
                      )}
                    </div>
                    <Link
                      to="/zavody"
                      className={`btn btn-sm w-100 mt-auto ${isPast ? 'btn-outline-secondary' : 'btn-primary'}`}
                      style={{ borderRadius: '6px', fontWeight: '500' }}
                    >
                      <i className={`bi ${isPast ? 'bi-trophy' : (race.registration ? 'bi-pencil-square' : 'bi-info-circle')} me-1`}></i>
                      {isPast ? 'Výsledky' : (race.registration ? 'Registrace' : 'Detail')}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== NEWS GRID ===== */}
      <div>
        <div className="mb-4" style={{
          borderBottom: '2px solid rgba(255, 107, 0, 0.3)',
          paddingBottom: '0.75rem'
        }}>
          <h2 className="mb-0" style={{
            fontSize: '1.5rem',
            fontWeight: '500',
            color: 'var(--text-primary)',
            opacity: '0.9'
          }}>
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
            <div className="row row-cols-1 row-cols-md-3 g-4">
              {posts.map(post => {
                const showImage = post.image_file_id && post.image_position !== 'none';
                const imageUrl = showImage ? API.getImageUrl(post.id, post.updated_at) : null;

                return (
                  <div key={post.id} className="col">
                    <div
                      className="card h-100"
                      style={{
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'default'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                    >
                      {showImage && (
                        <img
                          src={imageUrl}
                          className="card-img-top"
                          alt={post.title}
                          style={{
                            height: '180px',
                            objectFit: 'cover',
                            borderTopLeftRadius: '12px',
                            borderTopRightRadius: '12px'
                          }}
                        />
                      )}
                      <div className="card-body d-flex flex-column" style={{ padding: '1.25rem' }}>
                        {/* Date badge */}
                        <div className="mb-2">
                          <span className="badge bg-secondary">
                            <i className="bi bi-calendar3 me-1"></i>
                            {formatDate(post.created_at)}
                          </span>
                        </div>

                        <h5 className="card-title fw-bold mb-2" style={{
                          color: 'var(--text-primary)',
                          fontSize: '1.05rem',
                          lineHeight: '1.3'
                        }}>
                          {post.title}
                        </h5>

                        <div
                          className="card-text flex-grow-1"
                          style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}
                          dangerouslySetInnerHTML={{ __html: `<p>${formatText(post.content)}</p>` }}
                        />

                        {post.document_file_id && (
                          <div className="mt-auto pt-2">
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
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-4">
              <Link
                to="/archiv-zprav"
                className="btn btn-outline-secondary"
                style={{
                  borderRadius: '8px',
                  padding: '0.75rem 2rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                <span className="bi bi-arrow-right me-2"></span>
                Zobrazit starší zprávy
              </Link>
            </div>
          </>
        )}
      </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Homepage;
