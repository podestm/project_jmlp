import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API, { API_CONFIG } from '../../config/api.js';
import { fixEncoding, formatText } from '../../utils/text.js';
import { formatDate, getRelativeTime } from '../../utils/date.js';

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
      {/* Hero sekce */}
      

      {/* Aktuality */}
      <div className="row">
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
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
            <div className="row g-4">
              {posts.map((post) => (
                <div key={post.id} className="col-12">
                  <div className="card">
                    {post.image_path && (
                      <img 
                        src={`${API}/images/${post.image_path}`} 
                        className="card-img-top" 
                        alt={post.title}
                        style={{ height: '200px', objectFit: 'cover' }}
                      />
                    )}
                    <div className="card-body">
                      <h5 className="card-title">{post.title}</h5>
                      <div 
                        className="card-text mb-3"
                        dangerouslySetInnerHTML={{ __html: `<p>${formatText(post.content)}</p>` }}
                      />
                      <small className="text-muted">
                        <span className="bi bi-calendar3 me-1"></span>
                        {formatDate(post.created_at)}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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