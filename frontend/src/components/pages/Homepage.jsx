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
      // Načteme nadcházející závody
      const upcomingData = await API.get(API_CONFIG.ENDPOINTS.RACES, { 
        current_season: true, 
        upcoming: true 
      });
      
      // Oprav kódování u nadcházejících
      const fixedUpcoming = upcomingData.map(race => ({
        ...race,
        areal_name: fixEncoding(race.areal_name),
        organizer_name: fixEncoding(race.organizer_name),
        isPast: false
      }));
      
      // Vždy chceme 3 závody celkem
      const totalToShow = 3;
      const upcomingCount = fixedUpcoming.length;
      
      // Pokud máme méně než 3 nadcházející, doplníme uplynulými
      if (upcomingCount < totalToShow) {
        const needPast = totalToShow - upcomingCount;
        
        const pastData = await API.get(API_CONFIG.ENDPOINTS.RACES, { 
          current_season: true,
          past: true,
          limit: needPast
        });
        
        const fixedPast = pastData.map(race => ({
          ...race,
          areal_name: fixEncoding(race.areal_name),
          organizer_name: fixEncoding(race.organizer_name),
          isPast: true
        }));
        
        // Uplynulé na začátek (nejnovější první), pak nadcházející
        const combined = [
          ...fixedPast.slice(0, needPast).reverse(),
          ...fixedUpcoming
        ];
        
        setUpcomingRaces(combined);
      } else {
        // Máme dost nadcházejících, zobrazíme jen první 3
        setUpcomingRaces(fixedUpcoming.slice(0, totalToShow));
      }
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
                className="text-muted mb-0" 
                style={{ fontSize: '1rem' }}
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
        <div className="col-lg-8">
          <div className="mb-4" style={{
            background: 'linear-gradient(135deg, #8b95a1 0%, #7a8694 100%)',
            color: 'white',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 className="mb-0" style={{ fontSize: '1.5rem', fontWeight: '600' }}>
              <span className="bi bi-newspaper me-2"></span>
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
                        border: '1px solid #dee2e6',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'default'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
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
                            color: '#2c3e50',
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
        <div className="col-lg-4">
          {/* Nadcházející závody */}
          <div className="card mb-4" style={{
            borderRadius: '12px',
            border: '1px solid #dee2e6',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div className="card-header" style={{
              background: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
              color: 'white',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              padding: '1rem 1.25rem'
            }}>
              <h5 className="card-title mb-0">
                <span className="bi bi-trophy-fill me-2"></span>
                Nadcházející závody
              </h5>
            </div>
            <div className="card-body" style={{ padding: '1.25rem' }}>
              {upcomingRaces.length === 0 ? (
                <p className="text-muted mb-0">
                  <span className="bi bi-info-circle me-1"></span>
                  Žádné nadcházející závody
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {upcomingRaces.map((race, index) => (
                    <div 
                      key={race.id} 
                      className="list-group-item py-3"
                      style={{
                        borderLeft: race.isPast 
                          ? '4px solid #d3d3d3'  // Světle šedá pro uplynulé závody
                          : race.registration 
                            ? '4px solid #198754'  // Zelená pro otevřenou registraci
                            : '4px solid #dc3545', // Červená pro uzavřenou
                        paddingLeft: '1rem',
                        paddingRight: '0',
                        marginLeft: '0.5rem',
                        borderTop: index === 0 ? 'none' : undefined,
                        borderRight: 'none',
                        borderBottom: index === upcomingRaces.length - 1 ? 'none' : undefined,
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="flex-grow-1">
                          <h6 className="mb-1 fw-bold" style={{ color: '#2c3e50' }}>
                            {race.areal_name || 'Závod'}
                          </h6>
                          <small className="text-muted">
                            <span className="bi bi-calendar3 me-2"></span>
                            {new Date(race.datum).toLocaleDateString('cs-CZ')}
                          </small>
                        </div>
                        <span 
                          className={`badge ${
                            race.isPast 
                              ? 'bg-secondary' 
                              : race.registration 
                                ? 'bg-success' 
                                : 'bg-danger'
                          }`}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px'
                          }}
                        >
                          {race.isPast ? 'Ukončeno' : race.registration ? 'Otevřeno' : 'Uzavřeno'}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Link 
                          to={`/zavod/${race.id}`}
                          className="btn btn-sm btn-outline-primary text-decoration-none"
                          style={{
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            padding: '0.375rem 0.75rem',
                            fontWeight: '500'
                          }}
                        >
                          <span className="bi bi-eye me-1"></span>
                          Detail závodu
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {upcomingRaces.length > 0 && (
                <div className="mt-3 pt-3 border-top">
                  <Link 
                    to="/terminovka"
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

          {/* Celkové výsledky sezóny */}
          {seasonResult && (
            <div 
              className="card mb-4"
              style={{
                borderRadius: '12px',
                border: '1px solid #dee2e6',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              <div className="card-header" style={{
                background: 'linear-gradient(135deg, #5bc0de 0%, #46b8da 100%)',
                color: 'white',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                padding: '1rem 1.25rem'
              }}>
                <h5 className="card-title mb-0" style={{ fontSize: '1.1rem' }}>
                  <span className="bi bi-file-earmark-text-fill me-2"></span>
                  Celkové výsledky sezóny {seasonResult.season_year_start}/{seasonResult.season_year_end}
                </h5>
              </div>
              <div className="card-body" style={{ padding: '1.25rem' }}>
                <p className="text-muted mb-3" style={{ fontSize: '0.95rem' }}>
                  <span className="bi bi-info-circle me-2"></span>
                  Celkové pořadí závodníků za aktuální sezónu
                </p>
                <a 
                  href={`${API_BASE}${seasonResult.document_file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn w-100 text-white text-decoration-none"
                  style={{
                    background: 'linear-gradient(135deg, #5bc0de 0%, #46b8da 100%)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    fontWeight: '500',
                    border: 'none',
                    boxShadow: '0 2px 4px rgba(91, 192, 222, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(91, 192, 222, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(91, 192, 222, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="bi bi-file-earmark-pdf me-2"></span>
                  Stáhnout celkové výsledky
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Homepage