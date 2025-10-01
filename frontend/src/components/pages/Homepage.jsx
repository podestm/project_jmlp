import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding, formatText } from '../../utils/text.js';
import { formatDate, getRelativeTime } from '../../utils/date.js';
import jmlpLogo from '../../assets/images/jmlp_logo.png';
import czechSkiLogo from '../../assets/images/czech_ski_snowboard-logo.png';

function Homepage() {
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
      const data = await API.get(API_CONFIG.ENDPOINTS.RACES, { 
        current_season: true, 
        upcoming: true 
      });
      
      // Oprav kódování u názvu areálu a organizátora
      const fixedData = data.map(race => ({
        ...race,
        areal_name: fixEncoding(race.areal_name),
        organizer_name: fixEncoding(race.organizer_name)
      }));
      
      setUpcomingRaces(fixedData.slice(0, 3));
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
      <div className="hero-section bg-light mb-5">
        <div className="container py-4">
          <div className="row align-items-center">
            <div className="col-md-3 text-center">
              <img 
                src={jmlpLogo} 
                alt="JMLP Logo" 
                className="img-fluid"
                style={{ maxHeight: '200px' }}
              />
            </div>
            <div className="col-md-6 text-center">
              <h1 className="display-4 mb-3">Jihomoravský Lyžařský Pohár</h1>
            </div>
            <div className="col-md-3 text-center">
              <img 
                src={czechSkiLogo} 
                alt="Czech Ski & Snowboard Logo" 
                className="img-fluid"
                style={{ maxHeight: '200px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aktuality */}
      <div className="row">
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <span className="bi bi-newspaper me-2"></span>
              Aktuality
            </h2>
            <Link to="/archiv-zprav" className="btn btn-outline-primary btn-sm">
              <span className="bi bi-archive me-1"></span>
              Archiv zpráv
            </Link>
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
                  
                  return (
                    <div key={post.id} className="col-12">
                      <div className="card">
                        {/* Obrázek nad textem (top) */}
                        {showImage && imagePosition === 'top' && (
                          <img 
                            src={`${API_CONFIG.BASE_URL}/posts/${post.id}/image`} 
                            className="card-img-top" 
                            alt={post.title}
                            style={{ height: '200px', objectFit: 'cover' }}
                          />
                        )}
                        
                        <div className="card-body">
                          <h5 className="card-title">{post.title}</h5>
                          
                          <div className="row align-items-start">
                            {/* Obrázek vlevo */}
                            {showImage && imagePosition === 'left' && (
                              <div className="col-md-5">
                                <img 
                                  src={`${API_CONFIG.BASE_URL}/posts/${post.id}/image`} 
                                  className="img-thumbnail mb-3" 
                                  alt={post.title}
                                  style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
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
                                    href={`${API_CONFIG.BASE_URL}/posts/${post.id}/document/download`}
                                    className="btn btn-sm btn-outline-primary"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <span className="bi bi-file-text me-1"></span>
                                    Stáhnout přílohu
                                  </a>
                                </div>
                              )}
                            </div>
                            
                            {/* Obrázek vpravo */}
                            {showImage && imagePosition === 'right' && (
                              <div className="col-md-5">
                                <img 
                                  src={`${API_CONFIG.BASE_URL}/posts/${post.id}/image`} 
                                  className="img-thumbnail mb-3" 
                                  alt={post.title}
                                  style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                                />
                              </div>
                            )}
                          </div>
                          
                          <small className="text-muted">
                            <span className="bi bi-calendar3 me-1"></span>
                            {formatDate(post.created_at)}
                          </small>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="text-center mt-4">
                <Link to="/archiv-zprav" className="btn btn-outline-secondary">
                  <span className="bi bi-arrow-right me-1"></span>
                  Zobrazit starší zprávy
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Boční panel */}
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <span className="bi bi-trophy-fill me-2"></span>
                Nadcházející závody
              </h5>
            </div>
            <div className="card-body">
              {upcomingRaces.length === 0 ? (
                <p className="text-muted mb-0">
                  <span className="bi bi-info-circle me-1"></span>
                  Žádné nadcházející závody
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {upcomingRaces.map((race) => (
                    <div key={race.id} className="list-group-item px-0 py-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1">{race.areal_name || 'Závod'}</h6>
                          <small className="text-muted">
                            <span className="bi bi-calendar3 me-1"></span>
                            {new Date(race.datum).toLocaleDateString('cs-CZ')}
                          </small>
                        </div>
                        <span className={`badge ${race.registration ? 'bg-success' : 'bg-secondary'}`}>
                          {race.registration ? 'Otevřeno' : 'Uzavřeno'}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Link 
                          to={`/zavod/${race.id}`}
                          className="btn btn-sm btn-outline-primary text-decoration-none"
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
                    className="btn btn-outline-primary w-100 text-decoration-none"
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