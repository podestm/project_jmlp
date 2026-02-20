import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding, formatText } from '../../utils/text.js';
import { formatDate, getRelativeTime } from '../../utils/date.js';
import jmlpLogo from '../../assets/images/jmlp_logo.png';
import czechSkiLogo from '../../assets/images/czech_ski_snowboard-logo.png';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Homepage() {
  const [posts, setPosts] = useState([]);
  const [upcomingRaces, setUpcomingRaces] = useState([]);
  const [seasonResult, setSeasonResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPosts();
    fetchUpcomingRaces();
    fetchSeasonResult();
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
      // Načteme všechny závody aktuální sezóny
      const allRaces = await API.get(API_CONFIG.ENDPOINTS.RACES, { 
        current_season: true
      });
      
      // Oprav kódování
      const fixedRaces = allRaces.map(race => ({
        ...race,
        areal_name: fixEncoding(race.areal_name),
        organizer_name: fixEncoding(race.organizer_name)
      }));
      
      // Seřaď: nejprve s otevřenou registrací (nejnovější první), 
      // pak bez registrace (nejnovější první)
      const sorted = fixedRaces.sort((a, b) => {
        // Pokud jeden má registraci a druhý ne, registrace má přednost
        if (a.registration && !b.registration) return -1;
        if (!a.registration && b.registration) return 1;
        
        // Pokud mají stejný stav registrace, seřaď podle data (nejnovější první)
        return new Date(b.datum) - new Date(a.datum);
      });
      
      // Zobraz prvních 5
      setUpcomingRaces(sorted.slice(0, 5));
    } catch (err) {
      console.error('Chyba při načítání závodů:', err);
    }
  };

  const fetchSeasonResult = async () => {
    try {
      const data = await API.get('/season-results/current');
      setSeasonResult(data);
    } catch (err) {
      // Season result je optional, nelogujeme error
      console.debug('Celkové výsledky aktuální sezóny nejsou dostupné');
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

  return (
    <div>
      {/* Hero sekce s logy */}
      <div 
        className="hero-section mb-4" 
        style={{
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderBottom: '3px solid #4a90e2',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          padding: '1.5rem 0'
        }}
      >
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-3 text-center mb-2 mb-md-0">
              <img 
                src={jmlpLogo} 
                alt="JMLP Logo" 
                className="img-fluid"
                style={{ 
                  maxHeight: '120px',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
                }}
              />
            </div>
            <div className="col-md-6 text-center">
              <h1 
                className="fw-bold mb-1" 
                style={{ 
                  color: '#2c3e50',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.05)',
                  fontSize: '2rem'
                }}
              >
                Jihomoravský Lyžařský Pohár
              </h1>
              <p 
                className="mb-0" 
                style={{ fontSize: '1rem', color: '#495057' }}
              >
                Seriál závodů pro všechny kategorie
              </p>
            </div>
            <div className="col-md-3 text-center mt-2 mt-md-0">
              <img 
                src={czechSkiLogo} 
                alt="Czech Ski & Snowboard Logo" 
                className="img-fluid"
                style={{ 
                  maxHeight: '120px',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aktuality */}
      <div className="row g-4">
        <div className="col-12 col-lg-8 order-2 order-lg-1">
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
              <div className="row g-4">
                {posts.map((post) => {
                  const showImage = post.image_file_id && post.image_position !== 'none';
                  const imagePosition = post.image_position || 'right';
                  // ✅ Použij helper z API pro relativní URL
                  const imageUrl = showImage ? API.getImageUrl(post.id, post.updated_at) : null;
                  
                  return (
                    <div key={post.id} className="col-12">
                      <div className="card" style={{
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'default'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}>
                        {/* Obrázek nad textem (top) */}
                        {showImage && imagePosition === 'top' && (
                          <img 
                            src={imageUrl} 
                            className="card-img-top" 
                            alt={post.title}
                            style={{ 
                              height: '250px', 
                              objectFit: 'cover',
                              borderTopLeftRadius: '12px',
                              borderTopRightRadius: '12px'
                            }}
                          />
                        )}
                        
                        <div className="card-body" style={{ padding: '1.5rem' }}>
                          <h5 className="card-title fw-bold mb-3" style={{ 
                            color: 'var(--text-primary)',
                            fontSize: '1.5rem'
                          }}>
                            {post.title}
                          </h5>
                          
                          <div className="row align-items-start">
                            {/* Obrázek vlevo */}
                            {showImage && imagePosition === 'left' && (
                              <div className="col-md-5 mb-3 mb-md-0">
                                <img 
                                  src={imageUrl} 
                                  className="img-thumbnail" 
                                  alt={post.title}
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '300px', 
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    border: '2px solid #e9ecef'
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Obsah textu */}
                            <div className={
                              showImage && (imagePosition === 'left' || imagePosition === 'right') 
                                ? "col-md-7" 
                                : "col-12"
                            }>
                              <div 
                                className="card-text mb-3"
                                dangerouslySetInnerHTML={{ __html: `<p>${formatText(post.content)}</p>` }}
                              />
                              
                              {/* Tlačítko pro stažení dokumentu pod textem */}
                              {post.document_file_id && (
                                <div className="mb-3">
                                  <a 
                                    href={API.getDocumentUrl(post.id)}
                                    className="btn btn-outline-primary"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      borderRadius: '8px',
                                      padding: '0.5rem 1.25rem',
                                      fontWeight: '500',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <span className="bi bi-file-text me-2"></span>
                                    Stáhnout přílohu
                                  </a>
                                </div>
                              )}
                            </div>
                            
                            {/* Obrázek vpravo */}
                            {showImage && imagePosition === 'right' && (
                              <div className="col-md-5 mb-3 mb-md-0">
                                <img 
                                  src={imageUrl} 
                                  className="img-thumbnail" 
                                  alt={post.title}
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '300px', 
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    border: '2px solid #e9ecef'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 pt-3 border-top">
                            <small className="text-muted">
                              <span className="bi bi-calendar3 me-2"></span>
                              {formatDate(post.created_at)}
                            </small>
                          </div>
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

        {/* Boční panel */}
        <div className="col-12 col-lg-4 order-1 order-lg-2">
          {/* Nadcházející závody */}
          <div className="card mb-4" style={{
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
                <span className="bi bi-calendar-event-fill me-2"></span>
                Závody
              </h5>
            </div>
            <div className="card-body" style={{ padding: '1.25rem' }}>
              {upcomingRaces.length === 0 ? (
                <p className="text-muted mb-0">
                  <span className="bi bi-info-circle me-1"></span>
                  Žádné závody
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {upcomingRaces.map((race, index) => {
                    // Zjistíme, jestli se závod už jel (datum v minulosti)
                    const raceDate = new Date(race.datum);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isPast = raceDate < today;
                    
                    // Určíme text a ikonu tlačítka
                    let buttonText, buttonIcon;
                    if (isPast) {
                      buttonText = 'Výsledky';
                      buttonIcon = 'bi-trophy';
                    } else if (race.registration) {
                      buttonText = 'Registrace';
                      buttonIcon = 'bi-pencil-square';
                    } else {
                      buttonText = 'Detail';
                      buttonIcon = 'bi-info-circle';
                    }
                    
                    return (
                      <div 
                        key={race.id} 
                        className="list-group-item py-3"
                        style={{
                          borderLeft: 'none',
                          paddingLeft: '1rem',
                          paddingRight: '0',
                          marginLeft: '0.5rem',
                          borderTop: index === 0 ? 'none' : undefined,
                          borderRight: 'none',
                          borderBottom: index === upcomingRaces.length - 1 ? 'none' : undefined,
                          transition: 'background-color 0.2s ease',
                          background: 'transparent'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1 d-flex align-items-start">
                            {/* Status tečka - šedá pro odjeté, zelená pro otevřenou reg., červená pro zavřenou */}
                            <span 
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: isPast ? '#6b7280' : (race.registration ? '#10b981' : '#ef4444'),
                                marginRight: '12px',
                                marginTop: '4px',
                                flexShrink: 0
                              }}
                              title={isPast ? 'Závod proběhl' : (race.registration ? 'Registrace otevřena' : 'Registrace uzavřena')}
                            />
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                <h6 className="mb-0 fw-bold" style={{ color: 'var(--text-primary)' }}>
                                  {race.areal_name || 'Závod'}
                                </h6>
                                {/* Ikona podle typu závodu (raceMethod_id: 1=sníh, 2=sucho) */}
                                {race.raceMethod_id && (
                                  <span 
                                    style={{ 
                                      fontSize: '1.5rem',
                                      lineHeight: '1'
                                    }}
                                    title={race.raceMethod_id === 1 ? 'Závod na sněhu' : 'Suchý závod'}
                                  >
                                    {race.raceMethod_id === 1 ? '❄️' : '🌲'}
                                  </span>
                                )}
                                {/* Badge pro ukončený závod */}
                                {isPast && (
                                  <span 
                                    className="badge"
                                    style={{
                                      backgroundColor: 'rgba(107, 114, 128, 0.2)',
                                      color: '#9ca3af',
                                      fontSize: '0.7rem',
                                      fontWeight: '500',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    Závod ukončen
                                  </span>
                                )}
                              </div>
                              <small className="text-muted">
                                <span className="bi bi-calendar3 me-2"></span>
                                {formatDate(race.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </small>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 ms-4">
                          <Link 
                            to={`/zavod/${race.id}`}
                            className={`btn btn-sm text-decoration-none ${isPast ? 'btn-secondary' : 'btn-primary'}`}
                            style={{
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              padding: '0.375rem 0.75rem',
                              fontWeight: '500'
                            }}
                          >
                            <span className={`bi ${buttonIcon} me-1`}></span>
                            {buttonText}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {upcomingRaces.length > 0 && (
                <div className="mt-3 pt-3 border-top">
                  <Link 
                    to="/registrace"
                    className="btn btn-primary w-100 text-decoration-none"
                    style={{
                      borderRadius: '8px',
                      padding: '0.75rem',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(13, 110, 253, 0.2)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span className="bi bi-calendar-check me-2"></span>
                    Zobrazit všechny závody
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Homepage