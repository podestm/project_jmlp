import React, { useState, useEffect } from 'react';
import API, { API_CONFIG } from '../../config/api.js';
import { formatDate } from '../../utils/date.js';
import { formatText } from '../../utils/text.js';

function NewsArchive() {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const postsPerPage = 10;

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    filterPosts();
  }, [posts, searchTerm, selectedYear, selectedMonth]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, selectedYear, selectedMonth]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await API.get(API_CONFIG.ENDPOINTS.POSTS);
      setPosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = posts;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by year
    if (selectedYear) {
      filtered = filtered.filter(post => {
        const postYear = new Date(post.created_at).getFullYear().toString();
        return postYear === selectedYear;
      });
    }

    // Filter by month
    if (selectedMonth) {
      filtered = filtered.filter(post => {
        const postMonth = (new Date(post.created_at).getMonth() + 1).toString().padStart(2, '0');
        return postMonth === selectedMonth;
      });
    }

    setFilteredPosts(filtered);
  };

  // Get unique years from posts
  const getAvailableYears = () => {
    const years = posts.map(post => new Date(post.created_at).getFullYear());
    return [...new Set(years)].sort((a, b) => b - a);
  };

  // Get months for selected year
  const getAvailableMonths = () => {
    if (!selectedYear) return [];
    
    const months = posts
      .filter(post => new Date(post.created_at).getFullYear().toString() === selectedYear)
      .map(post => new Date(post.created_at).getMonth() + 1);
    
    return [...new Set(months)].sort((a, b) => a - b);
  };

  const monthNames = [
    '', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
  ];

  // Get current posts for pagination
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedYear('');
    setSelectedMonth('');
    setCurrentPage(1);
  };

  const renderFilterBar = () => {
    return (
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-search me-1"></i>
                Hledat v příspěvcích
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Zadejte hledaný výraz..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">
                <i className="bi bi-calendar me-1"></i>
                Rok
              </label>
              <select
                className="form-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="">Všechny roky</option>
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">
                <i className="bi bi-calendar-month me-1"></i>
                Měsíc
              </label>
              <select
                className="form-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={!selectedYear}
              >
                <option value="">Všechny měsíce</option>
                {getAvailableMonths().map(month => (
                  <option key={month} value={month.toString().padStart(2, '0')}>
                    {monthNames[month]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <button 
                className="btn btn-outline-secondary w-100"
                onClick={clearFilters}
                disabled={!searchTerm && !selectedYear && !selectedMonth}
                style={{ marginTop: '1.5rem' }}
              >
                <i className="bi bi-x-circle me-1"></i>
                Vymazat filtry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPostList = () => {
    return (
      <div className="list-group">
        {currentPosts.map((post) => {
          const showImage = post.image_file_id && post.image_position !== 'none';
          const imagePosition = post.image_position || 'right';
          
          return (
            <article key={post.id} className="list-group-item list-group-item-action">
              {/* Obrázek nad textem (top) */}
              {showImage && imagePosition === 'top' && (
                <div className="mb-3">
                  <img
                    src={`${API_CONFIG.BASE_URL}/posts/${post.id}/image`}
                    className="img-fluid"
                    alt={post.title}
                    style={{ height: '200px', width: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              
              <div className="row align-items-start">
                {/* Obrázek vlevo */}
                {showImage && imagePosition === 'left' && (
                  <div className="col-md-2">
                    <img
                      src={`${API_CONFIG.BASE_URL}/posts/${post.id}/image`}
                      className="img-thumbnail"
                      alt={post.title}
                      style={{ height: '100px', width: '100px', objectFit: 'cover' }}
                    />
                  </div>
                )}
                
                {/* Obsah textu */}
                <div className={
                  showImage && (imagePosition === 'left' || imagePosition === 'right') 
                    ? "col-md-8" 
                    : "col-md-10"
                }>
                  <div className="d-flex w-100 justify-content-between align-items-start">
                    <h6 className="mb-1">{post.title}</h6>
                    <small className="text-muted">{formatDate(post.created_at)}</small>
                  </div>
                  <div 
                    className="mb-1 text-muted" 
                    style={{ fontSize: '0.9rem' }}
                    dangerouslySetInnerHTML={{
                      __html: formatText(post.content.length > 120 ? 
                        post.content.substring(0, 120) + '...' : 
                        post.content)
                    }}
                  />
                </div>
                
                {/* Obrázek vpravo */}
                {showImage && imagePosition === 'right' && (
                  <div className="col-md-2">
                    <img
                      src={`${API_CONFIG.BASE_URL}/posts/${post.id}/image`}
                      className="img-thumbnail"
                      alt={post.title}
                      style={{ height: '100px', width: '100px', objectFit: 'cover' }}
                    />
                  </div>
                )}
                
                {/* Tlačítko pro stažení */}
                <div className="col-md-2 text-end">
                  {post.document_file_id && (
                    <a 
                      href={`${API_CONFIG.BASE_URL}/posts/${post.id}/document/download`}
                      className="btn btn-sm btn-outline-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="bi bi-file-text"></span>
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    if (currentPage > 1) {
      pages.push(
        <li key="prev" className="page-item">
          <button
            className="page-link"
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
        </li>
      );
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <li key={i} className={`page-item ${i === currentPage ? 'active' : ''}`}>
          <button
            className="page-link"
            onClick={() => handlePageChange(i)}
          >
            {i}
          </button>
        </li>
      );
    }

    // Next button
    if (currentPage < totalPages) {
      pages.push(
        <li key="next" className="page-item">
          <button
            className="page-link"
            onClick={() => handlePageChange(currentPage + 1)}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </li>
      );
    }

    return (
      <nav aria-label="Stránkování">
        <ul className="pagination justify-content-center">
          {pages}
        </ul>
      </nav>
    );
  };

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Načítám...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          <strong>Chyba:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="display-6">Archiv zpráv a aktualit</h1>
            <div className="text-muted">
              <small>
                {filteredPosts.length !== posts.length 
                  ? `${filteredPosts.length} z ${posts.length} příspěvků`
                  : `Celkem ${posts.length} příspěvků`
                }
              </small>
            </div>
          </div>

          {renderFilterBar()}

          {filteredPosts.length === 0 ? (
            <div className="alert alert-info">
              <span className="bi bi-info-circle me-2"></span>
              {posts.length === 0 
                ? "Zatím nejsou k dispozici žádné aktuality."
                : "Žádné příspěvky neodpovídají vašim kritériím."
              }
            </div>
          ) : (
            <>
              {renderPostList()}

              {renderPagination()}

              <div className="text-center mt-4">
                <p className="text-muted">
                  Zobrazeno {indexOfFirstPost + 1}-{Math.min(indexOfLastPost, filteredPosts.length)} z {filteredPosts.length} příspěvků
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewsArchive;