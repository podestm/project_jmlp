import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { APP_CONFIG } from '../../config/constants.js';
import { useLiveStatus } from '../../contexts/LiveStatusContext.jsx';

export default function Navigation() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const liveRace = useLiveStatus();
  
  // Mapování URL na názvy stránek
  const getPageFromPath = (pathname) => {
    switch (pathname) {
      case '/': return 'uvod';
      case '/zavody': return 'zavody';
      case '/archiv-zprav': return 'aktuality';
      case '/dokumenty': return 'dokumenty';
      case '/kontakty': return 'kontakty';
      default:
        return 'uvod';
    }
  };
  
  const currentPage = getPageFromPath(location.pathname);
  
  const navigationItems = [
    { key: 'uvod', label: 'Úvod', icon: 'bi-house', path: '/' },
    { key: 'zavody', label: 'Závody', icon: 'bi-calendar3', path: '/zavody' },
    { key: 'aktuality', label: 'Aktuality', icon: 'bi-newspaper', path: '/archiv-zprav' },
    { key: 'dokumenty', label: 'Dokumenty', icon: 'bi-file-earmark-text', path: '/dokumenty' },
    { key: 'kontakty', label: 'Kontakty', icon: 'bi-envelope', path: '/kontakty' }
  ];

  return (
    <nav className="navbar navbar-dark navbar-expand-lg mb-4" style={{
      background: 'rgba(20, 30, 50, 0.6)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div className="container">
        {/* Brand */}
        <Link to="/" className="navbar-brand mb-0 h1 text-decoration-none" style={{color: '#ffffff', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'}}>
          <i className="bi bi-snow2 me-2"></i>
          <span className="d-none d-md-inline">{APP_CONFIG.FULL_NAME}</span>
          <span className="d-inline d-md-none">JMLP</span>
        </Link>
        
        {/* Hamburger Button */}
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Navigation Menu */}
        <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`}>
          <div className="ms-auto d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2">
            {navigationItems.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className={`btn ${
                  currentPage === item.key
                    ? 'btn-primary'
                    : 'btn-outline-light'
                } text-decoration-none`}
                style={currentPage === item.key ? {
                  borderBottom: '2px solid var(--sunset-orange)',
                  backgroundColor: 'transparent',
                  color: 'var(--sunset-orange)'
                } : {}}
                onClick={() => setIsMenuOpen(false)}
              >
                <i className={`${item.icon} me-1`}></i>
                {item.label}
              </Link>
            ))}
            {liveRace && (
              <Link
                to="/livetiming"
                className="btn text-white text-decoration-none"
                style={{
                  background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600'
                }}
                onClick={() => setIsMenuOpen(false)}
              >
                <span style={{
                  display: 'inline-block',
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  background: '#fff',
                  marginRight: '6px',
                  boxShadow: '0 0 6px #fff',
                  animation: 'livePulse 1.2s ease-in-out infinite'
                }} />
                Live
              </Link>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}